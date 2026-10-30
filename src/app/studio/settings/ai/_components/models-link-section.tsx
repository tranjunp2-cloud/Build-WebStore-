import Link from 'next/link'

/** Model chains moved to Providers & models › Routing; this card only points there. */
export function ModelsLinkSection() {
    return (
        <section className="aiq-card">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title">Model chains</div>
                    <div className="aiq-card-sub">Which model answers each tier, and the fallbacks, are set in Providers &amp; models › Routing.</div>
                </div>
                <Link className="btn btn-sm" href="/studio/settings/ai/models/routing">Open routing</Link>
            </div>
        </section>
    )
}
