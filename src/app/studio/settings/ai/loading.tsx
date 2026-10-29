export default function Loading() {
    return (
        <div className="page aiq-page" aria-busy="true">
            <div className="page-head">
                <div>
                    <h1 className="page-title">AI limits &amp; prices</h1>
                    <p className="page-sub">Loading settings…</p>
                </div>
            </div>
            {[1, 2, 3].map((n) => (
                <section key={n} className="aiq-card" style={{ height: 160, marginBottom: 12, opacity: 0.5 }} />
            ))}
        </div>
    )
}
