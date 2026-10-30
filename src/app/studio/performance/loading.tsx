import './ai-usage.css'
import { LimitsPanelSkeleton } from './_components/limits-panel'

/** Skeleton while the overview, logs or shop screen loads (same card rhythm as the real page). */
export default function Loading() {
    return (
        <div className="page au-page" aria-busy="true" aria-label="Loading AI usage">
            <div className="page-head"><div><span className="au-skel" style={{ width: 220, height: 22 }} /><span className="au-skel" style={{ width: 360, marginTop: 10 }} /></div></div>
            <section className="aiq-metrics">{[0, 1, 2, 3, 4].map((i) => (
                <div className="aiq-metric" key={i}><span className="au-skel" style={{ width: 70 }} /><span className="au-skel" style={{ width: 100, height: 22 }} /><span className="au-skel" style={{ width: '100%', height: 28 }} /></div>
            ))}</section>
            <LimitsPanelSkeleton />
            {[0, 1, 2].map((i) => (
                <section className="card" key={i}><div className="card-head"><span className="au-skel" style={{ width: 180 }} /></div>
                    <div className="au-card-body" style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3].map((r) => <span key={r} className="au-skel" style={{ width: `${90 - r * 12}%` }} />)}</div></section>
            ))}
        </div>
    )
}
