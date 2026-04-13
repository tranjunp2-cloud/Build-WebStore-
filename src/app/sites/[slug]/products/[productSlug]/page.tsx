import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AddToCartButton } from '@/components/storefront/AddToCartButton'
import { CartDrawer } from '@/components/storefront/CartDrawer'
import { TrackingManager } from '@/components/site-renderer/TrackingManager'

// Force dynamic — uses getPayload() for product data at runtime
export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string; productSlug: string }>
}

async function getProductData(slug: string, productSlug: string) {
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

    const productsResult = await payload.find({
        collection: 'products',
        where: {
            and: [
                { site: { equals: site.id } },
                { slug: { equals: productSlug } },
                { status: { equals: 'active' } },
            ],
        },
        limit: 1,
        depth: 2,
    })
    const product = productsResult.docs[0]
    if (!product) return null

    return { tenant, site, product }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, productSlug } = await params
    const data = await getProductData(slug, productSlug)
    if (!data) return { title: 'Not Found' }

    const { site, product } = data
    const title = (product as any).seo?.title || `${product.name} — ${site.name}`
    const description = (product as any).seo?.description || (product as any).shortDescription || `Buy ${product.name} from ${site.name}`
    const ogImage = (product as any).images?.[0]?.image?.url

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            ...(ogImage && { images: [{ url: ogImage }] }),
        },
    }
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

export default async function ProductDetailPage({ params }: Props) {
    const { slug, productSlug } = await params
    const data = await getProductData(slug, productSlug)

    if (!data) notFound()

    const { site, product } = data
    const p = product as any
    const primaryColor = (site.theme as any)?.primaryColor || '#0ea5e9'
    const images = p.images || []
    const hasDiscount = p.compareAtPrice && p.compareAtPrice > p.price
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0

    // JSON-LD Product schema
    const attributes = p.attributes || []
    
    // Convert attributes to Schema.org additionalProperty
    const additionalProperty = attributes.map((attr: any) => ({
        '@type': 'PropertyValue',
        name: attr.key,
        value: attr.value,
    }))

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: p.shortDescription || '',
        image: images[0]?.image?.url,
        sku: p.sku || undefined,
        offers: {
            '@type': 'Offer',
            price: p.price,
            priceCurrency: p.currency || 'MYR',
            availability: p.inventory > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
        ...(additionalProperty.length > 0 && { additionalProperty }),
    }

    return (
        <>
            <TrackingManager siteId={String(site.id)} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <div style={{ fontFamily: `${(site.theme as any)?.fontBody || 'Inter'}, sans-serif` }}>
                {/* Nav */}
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
                        <Link href={`/sites/${slug}/products`} style={{ color: '#666', textDecoration: 'none' }}>Products</Link>
                    </div>
                </nav>

                {/* Breadcrumb */}
                <div style={{ padding: '16px 32px', fontSize: '13px', color: '#999', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    <Link href={`/sites/${slug}/products`} style={{ color: primaryColor, textDecoration: 'none' }}>Products</Link>
                    <span style={{ margin: '0 4px' }}>/</span>
                    {p.category && typeof p.category === 'object' && p.category.breadcrumbs && (
                        <>
                            {p.category.breadcrumbs.split(' > ').map((crumb: string, i: number) => (
                                <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ color: '#666' }}>{crumb}</span>
                                    <span style={{ margin: '0 8px' }}>/</span>
                                </span>
                            ))}
                        </>
                    )}
                    <span style={{ color: '#111', fontWeight: 500 }}>{p.name}</span>
                </div>

                {/* Product Detail */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: '48px', padding: '0 32px 64px', maxWidth: '1200px', margin: '0 auto',
                }}>
                    {/* Images */}
                    <div>
                        <div style={{
                            borderRadius: '16px', overflow: 'hidden', background: '#f8f8f8',
                            aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {images[0]?.image?.url ? (
                                <img src={images[0].image.url} alt={images[0].alt || p.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '80px', opacity: 0.15 }}>📦</span>
                            )}
                        </div>

                        {/* Thumbnail row */}
                        {images.length > 1 && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                {images.slice(0, 5).map((img: any, i: number) => (
                                    <div key={i} style={{
                                        width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden',
                                        border: i === 0 ? `2px solid ${primaryColor}` : '1px solid #eee',
                                    }}>
                                        {img.image?.url && (
                                            <img src={img.image.url} alt={img.alt || `${p.name} ${i + 1}`}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div>
                        {p.category && typeof p.category === 'object' && (
                            <p style={{ fontSize: '13px', color: primaryColor, fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {p.category.name}
                            </p>
                        )}

                        <h1 style={{
                            fontSize: '32px', fontWeight: 700, margin: '0 0 16px', color: '#111',
                            fontFamily: `${(site.theme as any)?.fontHeading || 'Outfit'}, sans-serif`,
                        }}>
                            {p.name}
                        </h1>

                        {/* Price */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 700, color: '#111' }}>
                                {formatPrice(p.price, p.currency || 'MYR')}
                            </span>
                            {hasDiscount && (
                                <>
                                    <span style={{ fontSize: '18px', color: '#999', textDecoration: 'line-through' }}>
                                        {formatPrice(p.compareAtPrice, p.currency || 'MYR')}
                                    </span>
                                    <span style={{
                                        background: '#fef2f2', color: '#ef4444', fontSize: '13px',
                                        fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                                    }}>
                                        -{discountPercent}%
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Stock */}
                        <p style={{
                            fontSize: '13px', marginBottom: '24px',
                            color: p.inventory > 10 ? '#22c55e' : p.inventory > 0 ? '#f59e0b' : '#ef4444',
                        }}>
                            {p.inventory > 10 ? '✓ In Stock' : p.inventory > 0 ? `⚠ Only ${p.inventory} left` : '✕ Out of Stock'}
                        </p>

                        {/* Add to Cart */}
                        <AddToCartButton
                            product={{
                                id: String(p.id),
                                slug: p.slug,
                                name: p.name,
                                price: p.price,
                                compareAtPrice: p.compareAtPrice,
                                currency: p.currency || 'MYR',
                                imageUrl: images[0]?.image?.url,
                                inventory: p.inventory ?? 0,
                            }}
                            primaryColor={primaryColor}
                            siteSlug={slug}
                            siteId={String(site.id)}
                        />

                        {/* Extended Attributes Grid (US-F08-06) */}
                        {attributes && attributes.length > 0 && (
                            <div style={{ marginTop: '32px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111', marginBottom: '12px' }}>Specifications</h3>
                                <div style={{ 
                                    display: 'grid', gridTemplateColumns: '1fr', gap: '1px', 
                                    background: '#eee', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' 
                                }}>
                                    {attributes.map((attr: any, idx: number) => (
                                        <div key={idx} style={{ 
                                            display: 'grid', gridTemplateColumns: '120px 1fr', 
                                            background: '#fff', fontSize: '14px' 
                                        }}>
                                            <div style={{ padding: '12px 16px', background: '#fafafa', color: '#666', fontWeight: 500 }}>
                                                {attr.key}
                                            </div>
                                            <div style={{ padding: '12px 16px', color: '#111' }}>
                                                {attr.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {p.shortDescription && (
                            <div style={{ borderTop: '1px solid #eee', paddingTop: '24px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111', marginBottom: '8px' }}>Description</h3>
                                <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.7 }}>{p.shortDescription}</p>
                            </div>
                        )}

                        {/* SKU */}
                        {p.sku && (
                            <p style={{ fontSize: '12px', color: '#bbb', marginTop: '24px' }}>SKU: {p.sku}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart Drawer */}
            <CartDrawer siteSlug={slug} siteId={String(site.id)} />
        </>
    )
}
