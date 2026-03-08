import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'

type Props = {
    params: Promise<{ slug: string }>
}

async function getSiteAndProducts(slug: string) {
    const payload = await getPayload({ config })

    // Find tenant
    const tenantsResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
    })
    const tenant = tenantsResult.docs[0]
    if (!tenant) return null

    // Find published site for this tenant
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

    // Find active products for this site
    const productsResult = await payload.find({
        collection: 'products',
        where: {
            and: [
                { site: { equals: site.id } },
                { status: { equals: 'active' } },
                { or: [{ deletedAt: { exists: false } }, { deletedAt: { equals: null } }] },
            ],
        },
        limit: 100,
        depth: 2,
        sort: '-createdAt',
    })

    return { tenant, site, products: productsResult.docs }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const data = await getSiteAndProducts(slug)
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

export default async function StorefrontProductsPage({ params }: Props) {
    const { slug } = await params
    const data = await getSiteAndProducts(slug)

    if (!data) notFound()

    const { site, products } = data
    const primaryColor = (site.theme as any)?.primaryColor || '#0ea5e9'

    return (
        <div style={{ fontFamily: `${(site.theme as any)?.fontBody || 'Inter'}, sans-serif` }}>
            {/* Simple Nav */}
            <nav style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 32px', borderBottom: '1px solid #eee',
            }}>
                <Link href={`/sites/${slug}`} style={{
                    fontSize: '20px', fontWeight: 700, textDecoration: 'none', color: '#111',
                    fontFamily: `${(site.theme as any)?.fontHeading || 'Outfit'}, sans-serif`,
                }}>
                    {site.name}
                </Link>
                <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
                    <Link href={`/sites/${slug}`} style={{ color: '#666', textDecoration: 'none' }}>Home</Link>
                    <Link href={`/sites/${slug}/products`} style={{ color: primaryColor, fontWeight: 600, textDecoration: 'none' }}>Products</Link>
                </div>
            </nav>

            {/* Header */}
            <div style={{ textAlign: 'center', padding: '48px 16px 32px' }}>
                <h1 style={{
                    fontSize: '32px', fontWeight: 700, color: '#111', margin: 0,
                    fontFamily: `${(site.theme as any)?.fontHeading || 'Outfit'}, sans-serif`,
                }}>
                    Our Products
                </h1>
                <p style={{ fontSize: '16px', color: '#666', marginTop: '8px' }}>
                    {products.length} product{products.length !== 1 ? 's' : ''} available
                </p>
            </div>

            {/* Products Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px', padding: '0 32px 64px', maxWidth: '1200px', margin: '0 auto',
            }}>
                {products.map((product: any) => {
                    const imageUrl = product.images?.[0]?.image?.url || product.images?.[0]?.image?.thumbnailURL
                    const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price

                    return (
                        <Link key={product.id} href={`/sites/${slug}/products/${product.slug}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div style={{
                                borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee',
                                transition: 'box-shadow 0.2s', cursor: 'pointer',
                            }}>
                                {/* Image */}
                                <div style={{
                                    height: '240px', background: '#f8f8f8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    position: 'relative',
                                }}>
                                    {imageUrl ? (
                                        <img src={imageUrl} alt={product.images?.[0]?.alt || product.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: '48px', opacity: 0.2 }}>📦</span>
                                    )}
                                    {hasDiscount && (
                                        <span style={{
                                            position: 'absolute', top: '12px', right: '12px',
                                            background: '#ef4444', color: 'white', fontSize: '12px',
                                            fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                                        }}>
                                            SALE
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div style={{ padding: '16px' }}>
                                    {product.category && (
                                        <p style={{ fontSize: '12px', color: primaryColor, fontWeight: 500, margin: '0 0 4px' }}>
                                            {product.category}
                                        </p>
                                    )}
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px', color: '#111' }}>
                                        {product.name}
                                    </h3>
                                    {product.shortDescription && (
                                        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px', lineHeight: 1.4 }}>
                                            {product.shortDescription.slice(0, 80)}{product.shortDescription.length > 80 ? '...' : ''}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>
                                            {formatPrice(product.price, product.currency || 'MYR')}
                                        </span>
                                        {hasDiscount && (
                                            <span style={{ fontSize: '14px', color: '#999', textDecoration: 'line-through' }}>
                                                {formatPrice(product.compareAtPrice, product.currency || 'MYR')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>

            {products.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 16px', color: '#999' }}>
                    <p style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</p>
                    <p>No products available yet.</p>
                </div>
            )}
        </div>
    )
}
