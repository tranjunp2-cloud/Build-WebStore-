import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PlpSidebar } from '@/components/storefront/PlpSidebar'
import { getServerI18n } from '@/i18n/server'

export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getSiteAndProducts(slug: string, searchParams: { [key: string]: string | string[] | undefined }) {
    const payload = await getPayload({ config })

    const tenantsResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
    })
    const tenant = tenantsResult.docs[0]
    if (!tenant) return null

    const sitesResult = await payload.find({
        collection: 'sites',
        where: {
            and: [
                { tenant: { equals: tenant.id } },
                { status: { equals: 'published' } },
            ],
        },
        limit: 1,
    })
    const site = sitesResult.docs[0]
    if (!site) return null

    // Fetch all active products for the site to extract categories, prices, and attributes
    const allProductsResult = await payload.find({
        collection: 'products',
        where: {
            and: [
                { site: { equals: site.id } },
                { status: { equals: 'active' } },
                { or: [{ deletedAt: { exists: false } }, { deletedAt: { equals: null } }] },
            ],
        },
        limit: 1000,
        depth: 0,
    })

    let globalMinPrice = 0
    let globalMaxPrice = 0
    const availableAttributes: Record<string, Set<string>> = {}

    allProductsResult.docs.forEach((p: any) => {
        if (p.price !== undefined) {
            if (globalMinPrice === 0 || p.price < globalMinPrice) globalMinPrice = p.price
            if (p.price > globalMaxPrice) globalMaxPrice = p.price
        }
        if (p.attributes) {
            p.attributes.forEach((attr: any) => {
                if (!availableAttributes[attr.key]) availableAttributes[attr.key] = new Set()
                availableAttributes[attr.key].add(attr.value)
            })
        }
    })

    const attributesData = Object.keys(availableAttributes).map(key => ({
        key,
        values: Array.from(availableAttributes[key])
    }))

    const categoriesResult = await payload.find({
        collection: 'categories',
        where: { site: { equals: site.id } },
        limit: 200,
    })

    const categorySlug = searchParams.category ? String(searchParams.category) : undefined
    const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
    const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined

    const attrFilters: Record<string, string[]> = {}
    for (const key in searchParams) {
        if (key.startsWith('attr_')) {
            const attrKey = key.replace('attr_', '')
            const val = searchParams[key]
            if (val) {
                attrFilters[attrKey] = Array.isArray(val) ? val : [val]
            }
        }
    }

    const where: any = {
        and: [
            { site: { equals: site.id } },
            { status: { equals: 'active' } },
            { or: [{ deletedAt: { exists: false } }, { deletedAt: { equals: null } }] },
        ]
    }

    if (categorySlug) {
        const catObj = categoriesResult.docs.find((c: any) => c.slug === categorySlug)
        if (catObj) {
            where.and.push({ category: { equals: catObj.id } })
        }
    }

    if (minPrice !== undefined) where.and.push({ price: { greater_than_equal: minPrice } })
    if (maxPrice !== undefined) where.and.push({ price: { less_than_equal: maxPrice } })

    for (const [attrKey, attrValues] of Object.entries(attrFilters)) {
        where.and.push({
            attributes: {
                elemMatch: {
                    and: [
                        { key: { equals: attrKey } },
                        { value: { in: attrValues } }
                    ]
                }
            }
        })
    }

    const filteredProductsResult = await payload.find({
        collection: 'products',
        where,
        limit: 100,
        depth: 2,
        sort: '-createdAt',
    })

    return { 
        tenant, 
        site, 
        products: filteredProductsResult.docs,
        categories: categoriesResult.docs,
        attributes: attributesData,
        minPrice: globalMinPrice,
        maxPrice: globalMaxPrice
    }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params
    const searchParams = await props.searchParams
    const data = await getSiteAndProducts(params.slug, searchParams)
    if (!data) return { title: 'Not Found' }

    const { site } = data
    const title = `Products — ${site.name}`
    const description = (site.seo as any)?.metaDescription || `Browse products from ${site.name}`

    return {
        title,
        description,
        openGraph: { title, description, type: 'website' },
    }
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

export default async function StorefrontProductsPage(props: Props) {
    const params = await props.params
    const searchParams = await props.searchParams
    const data = await getSiteAndProducts(params.slug, searchParams)

    if (!data) notFound()

    const { t } = await getServerI18n()
    const { site, products, categories, attributes, minPrice, maxPrice } = data
    const primaryColor = (site.theme as any)?.primaryColor || '#0ea5e9'
    const viewMode = searchParams.view === 'list' ? 'list' : 'grid'

    return (
        <div style={{ fontFamily: `${(site.theme as any)?.fontBody || 'Inter'}, sans-serif` }}>
            {/* Simple Nav */}
            <nav style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 32px', borderBottom: '1px solid #eee',
            }}>
                <Link href={`/sites/${params.slug}`} style={{
                    fontSize: '20px', fontWeight: 700, textDecoration: 'none', color: '#111',
                    fontFamily: `${(site.theme as any)?.fontHeading || 'Outfit'}, sans-serif`,
                }}>
                    {site.name}
                </Link>
                <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
                    <Link href={`/sites/${params.slug}`} style={{ color: '#666', textDecoration: 'none' }}>{t.storefront.products.home}</Link>
                    <Link href={`/sites/${params.slug}/products`} style={{ color: primaryColor, fontWeight: 600, textDecoration: 'none' }}>{t.storefront.products.title}</Link>
                </div>
            </nav>

            {/* Header */}
            <div style={{ textAlign: 'center', padding: '48px 16px 32px' }}>
                <h1 style={{
                    fontSize: '32px', fontWeight: 700, color: '#111', margin: 0,
                    fontFamily: `${(site.theme as any)?.fontHeading || 'Outfit'}, sans-serif`,
                }}>
                    {t.storefront.products.ourProducts}
                </h1>
                <p style={{ fontSize: '16px', color: '#666', marginTop: '8px' }}>
                    {products.length} product{products.length !== 1 ? 's' : ''} available 
                    {searchParams.category ? ` in ${searchParams.category}` : ''}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                    <Link href={`?${new URLSearchParams({...searchParams as any, view: 'grid'}).toString()}`} scroll={false} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '4px', background: viewMode === 'grid' ? '#eee' : 'transparent', color: '#111', textDecoration: 'none' }}>Layout Grid</Link>
                    <Link href={`?${new URLSearchParams({...searchParams as any, view: 'list'}).toString()}`} scroll={false} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '4px', background: viewMode === 'list' ? '#eee' : 'transparent', color: '#111', textDecoration: 'none' }}>Layout List</Link>
                </div>
            </div>

            <div style={{ display: 'flex', maxWidth: '1200px', margin: '0 auto', gap: '48px', padding: '0 32px 64px' }}>
                <PlpSidebar 
                    categories={categories as any} 
                    attributes={attributes} 
                    minPrice={minPrice} 
                    maxPrice={maxPrice} 
                    primaryColor={primaryColor} 
                />

                <div style={{ flex: 1 }}>
                    {products.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '64px 16px', color: '#999', background: '#f9fafb', borderRadius: '12px' }}>
                            <p style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</p>
                            <p>{t.storefront.products.noMatch}</p>
                            <Link href={`/sites/${params.slug}/products`} style={{ color: primaryColor, textDecoration: 'none', display: 'inline-block', marginTop: '16px', fontWeight: 500 }}>{t.storefront.products.clearFilters}</Link>
                        </div>
                    )}

                    {viewMode === 'grid' ? (
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px'
                        }}>
                            {/* Render grid... */}
                            {products.map((product: any) => {
                                const imageUrl = product.images?.[0]?.image?.url || product.images?.[0]?.image?.thumbnailURL
                                const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price

                                return (
                                    <Link key={product.id} href={`/sites/${params.slug}/products/${product.slug}`}
                                        style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <div style={{
                                            borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee',
                                            transition: 'box-shadow 0.2s', cursor: 'pointer', height: '100%'
                                        }}>
                                            <div style={{
                                                height: '240px', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                                            }}>
                                                {imageUrl ? (
                                                    <img src={imageUrl} alt={product.images?.[0]?.alt || product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '48px', opacity: 0.2 }}>📦</span>
                                                )}
                                                {hasDiscount && (
                                                    <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#ef4444', color: 'white', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px' }}>
                                                        SALE
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ padding: '16px' }}>
                                                {product.category && typeof product.category === 'object' && (
                                                    <p style={{ fontSize: '12px', color: primaryColor, fontWeight: 500, margin: '0 0 4px', textTransform: 'uppercase' }}>
                                                        {product.category.name}
                                                    </p>
                                                )}
                                                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px', color: '#111' }}>{product.name}</h3>
                                                {product.shortDescription && (
                                                    <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px', lineHeight: 1.4 }}>
                                                        {product.shortDescription.slice(0, 70)}{product.shortDescription.length > 70 ? '...' : ''}
                                                    </p>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>{formatPrice(product.price, product.currency || 'MYR')}</span>
                                                    {hasDiscount && (
                                                        <span style={{ fontSize: '14px', color: '#999', textDecoration: 'line-through' }}>{formatPrice(product.compareAtPrice, product.currency || 'MYR')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Render list... */}
                            {products.map((product: any) => {
                                const imageUrl = product.images?.[0]?.image?.url || product.images?.[0]?.image?.thumbnailURL
                                const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price

                                return (
                                    <Link key={product.id} href={`/sites/${params.slug}/products/${product.slug}`}
                                        style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <div style={{
                                            display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee',
                                            transition: 'box-shadow 0.2s', cursor: 'pointer', height: '160px'
                                        }}>
                                            <div style={{
                                                width: '180px', flexShrink: 0, background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                                            }}>
                                                {imageUrl ? (
                                                    <img src={imageUrl} alt={product.images?.[0]?.alt || product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '48px', opacity: 0.2 }}>📦</span>
                                                )}
                                                {hasDiscount && (
                                                    <span style={{ position: 'absolute', top: '12px', left: '12px', background: '#ef4444', color: 'white', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px' }}>
                                                        SALE
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                <div>
                                                    {product.category && typeof product.category === 'object' && (
                                                        <p style={{ fontSize: '12px', color: primaryColor, fontWeight: 500, margin: '0 0 4px', textTransform: 'uppercase' }}>
                                                            {product.category.name}
                                                        </p>
                                                    )}
                                                    <h3 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px', color: '#111' }}>{product.name}</h3>
                                                    {product.shortDescription && (
                                                        <p style={{ fontSize: '14px', color: '#666', margin: '0 0 0', lineHeight: 1.5 }}>
                                                            {product.shortDescription.slice(0, 150)}{product.shortDescription.length > 150 ? '...' : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '20px', fontWeight: 700, color: '#111' }}>{formatPrice(product.price, product.currency || 'MYR')}</span>
                                                    {hasDiscount && (
                                                        <span style={{ fontSize: '15px', color: '#999', textDecoration: 'line-through' }}>{formatPrice(product.compareAtPrice, product.currency || 'MYR')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

