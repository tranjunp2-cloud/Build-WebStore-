import type { Page, Site } from '@/payload-types'

// Block renderers — each maps to a block type in the CMS
async function HeroSection({ block, theme }: { block: any; theme: any }) {
    const { variant = 'centered', headline, subheadline, ctaButtons = [], image, badge } = block
    return (
        <section
            className="relative min-h-[90vh] flex items-center"
            style={{
                background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, transparent 60%)`,
            }}
        >
            <div className="container mx-auto px-6">
                {variant === 'centered' && (
                    <div className="text-center max-w-4xl mx-auto">
                        {badge?.show && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border mb-6"
                                style={{ borderColor: `${theme.primaryColor}40`, color: theme.primaryColor, background: `${theme.primaryColor}10` }}>
                                {badge.text}
                            </div>
                        )}
                        <h1 className="text-5xl md:text-7xl font-bold font-heading leading-tight mb-6">{headline}</h1>
                        {subheadline && <p className="text-xl text-current/70 mb-10 max-w-2xl mx-auto">{subheadline}</p>}
                        {ctaButtons.length > 0 && (
                            <div className="flex flex-wrap gap-4 justify-center">
                                {ctaButtons.map((btn: any, i: number) => (
                                    <a key={i} href={btn.url}
                                        className={`px-8 py-4 rounded-xl font-semibold transition-all duration-200 ${btn.style === 'outline' ? 'border-2' : 'text-white'
                                            }`}
                                        style={
                                            btn.style === 'outline'
                                                ? { borderColor: theme.primaryColor, color: theme.primaryColor }
                                                : { background: theme.primaryColor }
                                        }>
                                        {btn.label}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {variant === 'split-left' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h1 className="text-5xl font-bold font-heading leading-tight mb-6">{headline}</h1>
                            {subheadline && <p className="text-xl opacity-70 mb-10">{subheadline}</p>}
                            <div className="flex flex-wrap gap-4">
                                {ctaButtons.map((btn: any, i: number) => (
                                    <a key={i} href={btn.url}
                                        className="px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200"
                                        style={{ background: theme.primaryColor }}>
                                        {btn.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                        {image?.url && (
                            <div className="relative">
                                <img src={image.url} alt={image.alt || headline}
                                    className="w-full h-auto rounded-2xl shadow-2xl" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}

function NavigationSection({ block, theme }: { block: any; theme: any }) {
    const { logoText, links = [], ctaButton } = block
    return (
        <nav
            className="sticky top-0 z-50 border-b backdrop-blur-md"
            style={{ borderColor: `${theme.primaryColor}20`, background: 'rgba(9,9,11,0.8)' }}
        >
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <div className="font-bold text-xl font-heading" style={{ color: theme.primaryColor }}>
                    {block.logo?.url
                        ? <img src={block.logo.url} alt={logoText || 'Logo'} className="h-8 w-auto" />
                        : logoText}
                </div>
                <div className="hidden md:flex items-center gap-8">
                    {links.map((link: any, i: number) => (
                        <a key={i} href={link.url}
                            className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity">
                            {link.label}
                        </a>
                    ))}
                </div>
                {ctaButton?.show && (
                    <a href={ctaButton.url || '#'}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                        style={{ background: theme.primaryColor }}>
                        {ctaButton.label}
                    </a>
                )}
            </div>
        </nav>
    )
}

function AboutSection({ block, theme }: { block: any; theme: any }) {
    const { headline, sectionLabel, layout = 'image-right' } = block
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {sectionLabel && (
                    <p className="text-sm font-semibold uppercase tracking-widest mb-4 text-center"
                        style={{ color: theme.primaryColor }}>{sectionLabel}</p>
                )}
                <div className={`grid grid-cols-1 ${layout !== 'centered' ? 'lg:grid-cols-2' : ''} gap-12 items-center`}>
                    <div>
                        <h2 className="text-4xl font-bold font-heading mb-6">{headline}</h2>
                        {block.body && (
                            <div className="prose prose-invert max-w-none opacity-80">
                                {/* Rich text content rendered here */}
                                <p>{typeof block.body === 'string' ? block.body : 'About us content'}</p>
                            </div>
                        )}
                    </div>
                    {block.image?.url && (
                        <div>
                            <img src={block.image.url} alt={block.image.alt || headline}
                                className="w-full h-auto rounded-2xl" />
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

function FeaturesSection({ block, theme }: { block: any; theme: any }) {
    const { headline, subheadline, features = [], layout = 'grid-3' } = block
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {block.sectionLabel && (
                        <p className="text-sm font-semibold uppercase tracking-widest mb-4"
                            style={{ color: theme.primaryColor }}>{block.sectionLabel}</p>
                    )}
                    <h2 className="text-4xl font-bold font-heading mb-4">{headline}</h2>
                    {subheadline && <p className="text-lg opacity-70">{subheadline}</p>}
                </div>
                <div className={`grid gap-8 ${layout === 'grid-2' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {features.map((feature: any, i: number) => (
                        <div key={i} className="p-8 rounded-2xl border" style={{ borderColor: `${theme.primaryColor}20`, background: `${theme.primaryColor}05` }}>
                            {feature.icon && <div className="text-3xl mb-4">{feature.icon}</div>}
                            <h3 className="text-xl font-bold font-heading mb-3">{feature.title}</h3>
                            <p className="opacity-70">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function TestimonialsSection({ block, theme }: { block: any; theme: any }) {
    const { headline, testimonials = [] } = block
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                <h2 className="text-4xl font-bold font-heading text-center mb-16">{headline || 'What Our Customers Say'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((t: any, i: number) => (
                        <div key={i} className="p-6 rounded-2xl border" style={{ borderColor: `${theme.primaryColor}20` }}>
                            <div className="flex gap-1 mb-4">
                                {Array.from({ length: t.rating || 5 }).map((_, j) => (
                                    <span key={j} style={{ color: theme.primaryColor }}>★</span>
                                ))}
                            </div>
                            <p className="opacity-80 mb-6 italic">"{t.quote}"</p>
                            <div className="flex items-center gap-3">
                                {t.avatar?.url && (
                                    <img src={t.avatar.url} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                                )}
                                <div>
                                    <p className="font-semibold">{t.name}</p>
                                    {(t.title || t.company) && (
                                        <p className="text-sm opacity-60">{[t.title, t.company].filter(Boolean).join(', ')}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function ContactSection({ block, theme }: { block: any; theme: any }) {
    const { headline, subtext, email, phone, address, formFields = [] } = block
    return (
        <section className="py-24">
            <div className="container mx-auto px-6 max-w-2xl text-center">
                <h2 className="text-4xl font-bold font-heading mb-4">{headline || 'Contact Us'}</h2>
                {subtext && <p className="opacity-70 mb-10">{subtext}</p>}
                <form className="space-y-4 text-left">
                    {formFields.map((field: any, i: number) => (
                        <div key={i}>
                            <label className="block text-sm font-medium mb-1 opacity-80">{field.label}</label>
                            {field.fieldType === 'textarea' ? (
                                <textarea name={field.fieldName} placeholder={field.placeholder}
                                    required={field.required} rows={4}
                                    className="w-full px-4 py-3 rounded-xl border bg-transparent"
                                    style={{ borderColor: `${theme.primaryColor}30` }} />
                            ) : (
                                <input type={field.fieldType || 'text'} name={field.fieldName}
                                    placeholder={field.placeholder} required={field.required}
                                    className="w-full px-4 py-3 rounded-xl border bg-transparent"
                                    style={{ borderColor: `${theme.primaryColor}30` }} />
                            )}
                        </div>
                    ))}
                    <button type="submit"
                        className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90"
                        style={{ background: theme.primaryColor }}>
                        Send Message
                    </button>
                </form>
                {(email || phone || address) && (
                    <div className="mt-12 space-y-2 opacity-70">
                        {email && <p>📧 {email}</p>}
                        {phone && <p>📞 {phone}</p>}
                        {address && <p>📍 {address}</p>}
                    </div>
                )}
            </div>
        </section>
    )
}

function GallerySection({ block, theme }: { block: any; theme: any }) {
    const { headline, images = [] } = block
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {headline && <h2 className="text-4xl font-bold font-heading text-center mb-12">{headline}</h2>}
                <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                    {images.map((item: any, i: number) => (
                        <div key={i} className="break-inside-avoid">
                            <img src={item.image?.url} alt={item.caption || item.image?.alt || ''}
                                className="w-full h-auto rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function FooterSection({ block, theme }: { block: any; theme: any }) {
    const { logoText, tagline, columns = [], copyrightText } = block
    return (
        <footer className="py-16 border-t" style={{ borderColor: `${theme.primaryColor}20` }}>
            <div className="container mx-auto px-6">
                <div className={`grid grid-cols-1 md:grid-cols-${Math.min(columns.length + 1, 4)} gap-8 mb-12`}>
                    <div>
                        <div className="font-bold text-2xl font-heading mb-3" style={{ color: theme.primaryColor }}>
                            {block.logo?.url ? <img src={block.logo.url} alt={logoText} className="h-8 w-auto" /> : logoText}
                        </div>
                        {tagline && <p className="opacity-60 text-sm">{tagline}</p>}
                    </div>
                    {columns.map((col: any, i: number) => (
                        <div key={i}>
                            <h4 className="font-semibold mb-4">{col.title}</h4>
                            <ul className="space-y-2">
                                {(col.links || []).map((link: any, j: number) => (
                                    <li key={j}>
                                        <a href={link.url} className="text-sm opacity-60 hover:opacity-100 transition-opacity">
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                {copyrightText && (
                    <div className="pt-8 border-t text-sm opacity-50 text-center" style={{ borderColor: `${theme.primaryColor}20` }}>
                        {copyrightText}
                    </div>
                )}
            </div>
        </footer>
    )
}

// ── Block type → component mapping ─────────────────────────────────────────
const BLOCK_MAP: Record<string, React.ComponentType<any>> = {
    navigation: NavigationSection,
    hero: HeroSection,
    about: AboutSection,
    features: FeaturesSection,
    testimonials: TestimonialsSection,
    contact: ContactSection,
    gallery: GallerySection,
    footer: FooterSection,
}

// ── SiteRenderer — renders all blocks for a page ────────────────────────────
type SiteRendererProps = {
    site: any
    page: any
}

export function SiteRenderer({ site, page }: SiteRendererProps) {
    const theme = {
        primaryColor: site.theme?.primaryColor || '#0ea5e9',
        secondaryColor: site.theme?.secondaryColor || '#d946ef',
        backgroundColor: site.theme?.backgroundColor || '#09090b',
        fontHeading: site.theme?.fontHeading || 'Outfit',
        fontBody: site.theme?.fontBody || 'Inter',
        colorMode: site.theme?.colorMode || 'dark',
    }

    const blocks: any[] = page.layout || []

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href={`https://fonts.googleapis.com/css2?family=${theme.fontHeading.replace(/ /g, '+')}:wght@400;600;700;900&family=${theme.fontBody.replace(/ /g, '+')}:wght@400;500;600&display=swap`}
                    rel="stylesheet"
                />
                <style>{`
          :root {
            --brand-primary: ${theme.primaryColor};
            --brand-secondary: ${theme.secondaryColor};
            --font-heading: '${theme.fontHeading}', sans-serif;
            --font-body: '${theme.fontBody}', sans-serif;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html { scroll-behavior: smooth; }
          body {
            font-family: var(--font-body);
            background: ${theme.colorMode === 'dark' ? '#09090b' : '#ffffff'};
            color: ${theme.colorMode === 'dark' ? '#fafafa' : '#09090b'};
          }
          h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
          .container { max-width: 1200px; margin: 0 auto; }
          img { max-width: 100%; height: auto; }
          a { color: inherit; text-decoration: none; }
        `}</style>
            </head>
            <body>
                {blocks.map((block, index) => {
                    const BlockComponent = BLOCK_MAP[block.blockType]
                    if (!BlockComponent) return null
                    return (
                        <BlockComponent
                            key={`${block.blockType}-${index}`}
                            block={block}
                            theme={theme}
                        />
                    )
                })}
            </body>
        </html>
    )
}
