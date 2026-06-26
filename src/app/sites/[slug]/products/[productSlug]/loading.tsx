/**
 * PDP loading fallback. The product detail page is force-dynamic and renders
 * SiteLayoutShell (header/footer) itself, so this skeleton replaces the WHOLE
 * page while the RSC streams — there's no site/theme context here. Blocks use a
 * semi-transparent neutral grey that reads on both light and dark storefronts.
 */
const sk = (style: React.CSSProperties): React.CSSProperties => ({
    background: 'rgba(128,128,128,0.18)',
    borderRadius: 8,
    ...style,
})

export default function ProductDetailLoading() {
    return (
        <div className="animate-pulse" style={{ minHeight: '100vh' }}>
            {/* Header bar placeholder (SiteLayoutShell nav isn't available yet) */}
            <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                <div style={sk({ height: 24, width: 110 })} />
                <div style={{ display: 'flex', gap: 24 }}>
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} style={sk({ height: 14, width: 64 })} />)}
                </div>
                <div style={sk({ height: 38, width: 120, borderRadius: 10 })} />
            </div>

            {/* Breadcrumb */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 0', display: 'flex', gap: 8 }}>
                <div style={sk({ height: 12, width: 56 })} />
                <div style={sk({ height: 12, width: 56 })} />
                <div style={sk({ height: 12, width: 80 })} />
            </div>

            {/* Two-column product layout (mirrors .pd-grid) */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 48,
                    padding: '24px 32px 64px',
                    maxWidth: 1200,
                    margin: '0 auto',
                }}
            >
                {/* Gallery: main square + thumbnails */}
                <div>
                    <div style={sk({ aspectRatio: '1', width: '100%', borderRadius: 16 })} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={sk({ width: 64, height: 64, borderRadius: 10 })} />
                        ))}
                    </div>
                </div>

                {/* Info column: title, price, description, CTA, specs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={sk({ height: 34, width: '70%' })} />
                    <div style={sk({ height: 26, width: 140 })} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                        <div style={sk({ height: 14, width: '100%' })} />
                        <div style={sk({ height: 14, width: '92%' })} />
                        <div style={sk({ height: 14, width: '85%' })} />
                    </div>
                    <div style={sk({ height: 48, width: '100%', borderRadius: 12, marginTop: 16 })} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 16 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={sk({ height: 40, width: '100%', borderRadius: 0 })} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
