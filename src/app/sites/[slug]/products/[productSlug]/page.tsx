import { cache } from 'react'
import { Check, AlertTriangle, X } from 'lucide-react'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductAddToCartSection } from '@/components/storefront/product-add-to-cart-section'
import { ProductImageGallery } from '@/components/storefront/ProductImageGallery'
import { getCurrentUser } from '@/lib/auth'
import type { TenantMembership } from '@/lib/normalize-tenants'
import { getServerI18n } from '@/i18n/server'
import { SiteLayoutShell } from '@/components/site-renderer/SiteLayoutShell'
import { getSiteBasePath } from '@/lib/site-base-path'
import type { NavPage, SiteRendererProps } from '@/components/site-renderer/SiteRenderer'
import { ScrollToTop } from '@/components/storefront/scroll-to-top'
import { resolveStorefrontOrigin } from '@/lib/seo/canonical'
import { serializeJsonLd } from '@/lib/seo/json-ld'

// Force dynamic — uses getPayload() for product data at runtime
export const dynamic = 'force-dynamic'

type Props = {
    params: Promise<{ slug: string; productSlug: string }>
}

const getProductData = cache(async function getProductData(slug: string, productSlug: string) {
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

    // Fetch nav pages for SiteLayoutShell header/footer URL rewriting
    const pagesResult = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
                { deletedAt: { exists: false } },
            ],
        },
        limit: 100,
        sort: 'createdAt',
    })

    return { tenant, site, product, pages: pagesResult.docs }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, productSlug } = await params
    const data = await getProductData(slug, productSlug)
    if (!data) return { title: 'Not Found' }

    const { site, product } = data
    const title = (product as any).seo?.title || `${product.name} — ${site.name}`
    const description = (product as any).seo?.description || (product as any).shortDescription || `Buy ${product.name} from ${site.name}`
    const ogImage = (product as any).images?.[0]?.image?.url

    // BUG-F05-020: Resolve canonical URL for product pages
    const reqHeaders = await headers()
    const tenantHostname = reqHeaders.get('x-tenant-hostname')
    const baseUrl = resolveStorefrontOrigin(data.tenant as any, { fallbackHostname: tenantHostname, slug })
    const canonical = baseUrl ? `${baseUrl}/products/${productSlug}` : undefined

    return {
        title,
        description,
        alternates: canonical ? { canonical } : undefined,
        openGraph: {
            title,
            description,
            type: 'website',
            ...(canonical ? { url: canonical } : {}),
            ...(ogImage && { images: [{ url: ogImage }] }),
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            ...(ogImage ? { images: [ogImage] } : {}),
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

    const { t } = await getServerI18n()
    const { tenant, site, product, pages } = data

    interface ProductView {
        id: string | number
        slug: string
        name: string
        price: number
        compareAtPrice?: number
        currency?: string
        inventory: number
        sku?: string
        shortDescription?: string
        category?: { id: string; name: string; breadcrumbs?: string }
        attributes?: Array<{ key: string; value: string }>
        images?: Array<{ image?: { url: string }; alt?: string }>
        seo?: { title?: string; description?: string }
        // Variants (US-F08-02)
        hasVariants?: boolean
        variants?: Array<{
            name: string
            price: number
            compareAtPrice?: number | null
            stock: number
        }>
    }

    const p = product as ProductView
    const primaryColor = (site.theme as { primaryColor?: string } | undefined)?.primaryColor || '#0ea5e9'

    const user = await getCurrentUser()
    const isOwner = !!user && (user.tenants?.map((t: TenantMembership) =>
        typeof t.tenant === 'object' ? String(t.tenant.id) : String(t.tenant)
    ) ?? []).includes(String(tenant.id))

    const images = p.images || []
    const hasDiscount = p.compareAtPrice && p.compareAtPrice > p.price
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compareAtPrice!) * 100) : 0
    const attributes = p.attributes || []

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

    const base = await getSiteBasePath(slug)
    const siteWithContext = { ...site, tenantSlug: slug, siteBasePath: base }

    const origin = resolveStorefrontOrigin(tenant as any, { slug })
    const crumbs = [
        { name: 'Home', url: origin },
        ...(p.category?.name ? [{ name: p.category.name, url: undefined }] : []),
        { name: p.name, url: origin ? `${origin}/products/${p.slug}` : undefined },
    ]
    const breadcrumbJsonLd = origin ? {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem', position: i + 1, name: c.name,
            ...(c.url ? { item: c.url } : {}),
        })),
    } : null

    return (
        <SiteLayoutShell
            site={siteWithContext as SiteRendererProps['site']}
            pages={pages as unknown as NavPage[]}
            isOwner={isOwner}
            forceCartWidget
        >
            <ScrollToTop />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
            {breadcrumbJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />}
            <style>{`
                .pd-breadcrumb { padding: 16px 32px; }
                .pd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding: 0 32px 64px; max-width: 1200px; margin: 0 auto; }
                @media (max-width: 768px) {
                    .pd-breadcrumb { padding: 12px 16px; }
                    .pd-grid { grid-template-columns: 1fr; gap: 24px; padding: 0 16px 48px; }
                }
            `}</style>

            {/* Breadcrumb */}
            <div className="pd-breadcrumb" style={{ fontSize: '13px', color: 'var(--text-muted, #999)', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                <Link href={`${base}/products`} style={{ color: primaryColor, textDecoration: 'none' }}>Products</Link>
                <span style={{ margin: '0 4px' }}>/</span>
                {p.category && typeof p.category === 'object' && p.category.breadcrumbs && (
                    <>
                        {p.category.breadcrumbs.split(' > ').map((crumb: string, i: number) => (
                            <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{crumb}</span>
                                <span style={{ margin: '0 8px' }}>/</span>
                            </span>
                        ))}
                    </>
                )}
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{p.name}</span>
            </div>

            {/* Product Detail */}
            <div className="pd-grid">
                {/* Images */}
                <ProductImageGallery
                    images={images}
                    productName={p.name}
                    siteName={site.name ?? undefined}
                    primaryColor={primaryColor}
                />

                {/* Product Info */}
                <div>
                    {p.category && typeof p.category === 'object' && (
                        <p style={{ fontSize: '13px', color: primaryColor, fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {p.category.name}
                        </p>
                    )}

                    <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 16px', color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                        {p.name}
                    </h1>

                    {/* Price + Stock — server-rendered for non-variant products only.
                        Variant products: price display is inside ProductVariantSelector (client-side, updates on selection). */}
                    {(!p.hasVariants || !p.variants?.length) && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
                                    {formatPrice(p.price, p.currency || 'MYR')}
                                </span>
                                {hasDiscount && (
                                    <>
                                        <span style={{ fontSize: '18px', color: 'var(--text-muted, #999)', textDecoration: 'line-through' }}>
                                            {formatPrice(p.compareAtPrice!, p.currency || 'MYR')}
                                        </span>
                                        <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '13px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px' }}>
                                            -{discountPercent}%
                                        </span>
                                    </>
                                )}
                            </div>
                            <p style={{
                                fontSize: '13px', marginBottom: '24px',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                color: p.inventory > 10 ? '#22c55e' : p.inventory > 0 ? '#f59e0b' : '#ef4444',
                            }}>
                                {p.inventory > 10 ? (
                                    <><Check size={15} aria-hidden /> In Stock</>
                                ) : p.inventory > 0 ? (
                                    <><AlertTriangle size={15} aria-hidden /> Only {p.inventory} left</>
                                ) : (
                                    <><X size={15} aria-hidden /> Out of Stock</>
                                )}
                            </p>
                        </>
                    )}

                    {/* Client wrapper: holds selectedVariant state, renders Selector (variant only) + AddToCartButton */}
                    <ProductAddToCartSection
                        product={{
                            id: String(p.id),
                            slug: p.slug,
                            name: p.name,
                            price: p.price,
                            compareAtPrice: p.compareAtPrice,
                            currency: p.currency || 'MYR',
                            imageUrl: images[0]?.image?.url,
                            inventory: p.inventory ?? 0,
                            hasVariants: p.hasVariants,
                            variants: p.variants,
                        }}
                        primaryColor={primaryColor}
                        siteSlug={slug}
                        siteId={String(site.id)}
                    />

                    {/* Specifications */}
                    {attributes.length > 0 && (
                        <div style={{ marginTop: '32px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>{t.storefront.products.specifications}</h3>
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr', gap: '1px',
                                background: 'rgba(var(--brand-primary-rgb), 0.125)', border: '1px solid rgba(var(--brand-primary-rgb), 0.125)', borderRadius: '8px', overflow: 'hidden',
                            }}>
                                {attributes.map((attr: any, idx: number) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', background: 'var(--background)', fontSize: '14px' }}>
                                        <div style={{ padding: '12px 16px', background: 'rgba(var(--brand-primary-rgb), 0.03)', color: 'var(--text-muted)', fontWeight: 500 }}>
                                            {attr.key}
                                        </div>
                                        <div style={{ padding: '12px 16px', color: 'var(--text)' }}>
                                            {attr.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {p.shortDescription && (
                        <div style={{ borderTop: '1px solid rgba(var(--brand-primary-rgb), 0.125)', paddingTop: '24px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{t.storefront.products.description}</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7 }}>{p.shortDescription}</p>
                        </div>
                    )}

                    {/* SKU */}
                    {p.sku && (
                        <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '24px' }}>{t.storefront.products.sku} {p.sku}</p>
                    )}
                </div>
            </div>

        </SiteLayoutShell>
    )
}
