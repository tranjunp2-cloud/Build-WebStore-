/**
 * Studio route-group loading fallback. Renders inside AdminShell (sidebar +
 * topbar persist), so soft-nav between force-dynamic studio pages shows an
 * instant content skeleton instead of a frozen frame. Uses studio.css design
 * tokens (--bg-sunk / --border / --radius) so it tracks light & dark themes.
 */
const block = (style: React.CSSProperties) => ({
    borderRadius: 8,
    background: 'var(--bg-sunk)',
    ...style,
})

export default function StudioLoading() {
    return (
        <div className="page animate-pulse">
            <div className="page-head" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={block({ height: 28, width: 220 })} />
                    <div style={block({ height: 14, width: 340, marginTop: 10 })} />
                </div>
                <div style={block({ height: 38, width: 130 })} />
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: '14px 20px',
                            borderBottom: i === 7 ? 'none' : '1px solid var(--border)',
                        }}
                    >
                        <div style={block({ height: 40, width: 40, flexShrink: 0 })} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={block({ height: 14, width: '32%' })} />
                            <div style={block({ height: 12, width: '20%' })} />
                        </div>
                        <div style={block({ height: 14, width: 80 })} />
                        <div style={block({ height: 14, width: 56 })} />
                    </div>
                ))}
            </div>
        </div>
    )
}
