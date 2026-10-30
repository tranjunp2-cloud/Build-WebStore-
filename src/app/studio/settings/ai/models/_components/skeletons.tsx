
const Bar = ({ w, h = 12 }: { w: string; h?: number }) => <span className="pm-skel" style={{ width: w, height: h }} />

/** A card of placeholder rows. */
export function SkeletonCard({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
    return (
        <section className="aiq-card" aria-busy="true" aria-label={label}>
            <div className="aiq-card-head"><div style={{ display: 'grid', gap: 6, width: '100%' }}><Bar w="30%" h={13} /><Bar w="55%" h={10} /></div></div>
            <div style={{ display: 'grid', gap: 16, padding: 16 }}>
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className="pm-skel" style={{ width: 28, height: 28, borderRadius: 8 }} />
                        <div style={{ display: 'grid', gap: 6, flex: 1 }}><Bar w={`${60 - i * 8}%`} /><Bar w={`${35 + i * 5}%`} h={10} /></div>
                        <Bar w="72px" h={22} />
                    </div>
                ))}
            </div>
        </section>
    )
}

export function SkeletonTiers() {
    return (
        <div className="pm-tiers" aria-busy="true" aria-label="Loading tiers">
            {[0, 1, 2, 3].map((n) => <div key={n} className="pm-tier"><Bar w="40%" h={13} /><Bar w="70%" h={16} /><Bar w="55%" h={10} /><Bar w="80%" h={10} /></div>)}
        </div>
    )
}
