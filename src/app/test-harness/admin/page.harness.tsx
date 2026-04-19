import { readReport, isReportStale, readMatrix, loadRubric, scoreAll } from '../../../../scripts/test-harness/rubric/scorer-lib'
import { AdminClient } from './AdminClient'

export const dynamic = 'force-dynamic'

export default function AdminPage() {
    let report = readReport()
    const stale = isReportStale()

    // Fallback: score on-demand if pre-computed missing (slower first load)
    if (!report) {
        const matrix = readMatrix()
        if (!matrix) {
            return (
                <div
                    style={{
                        background: '#0a0a0a',
                        color: '#e5e5e5',
                        minHeight: '100vh',
                        padding: 40,
                        fontFamily: 'ui-monospace, Menlo, monospace',
                    }}
                >
                    <h1 style={{ fontSize: 24, color: '#fff', marginBottom: 12 }}>Harness matrix missing</h1>
                    <p>Run <code style={{ background: '#171717', padding: '2px 6px', borderRadius: 3 }}>npm run harness:gen</code> first to generate <code>.harness-out/matrix.json</code>.</p>
                </div>
            )
        }
        report = scoreAll(matrix, loadRubric())
    }

    return (
        <>
            {stale && (
                <div
                    style={{
                        background: '#f59e0b',
                        color: '#0a0a0a',
                        padding: '8px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'center',
                    }}
                >
                    ⚠ Report stale — matrix.json newer than rubric-report.json. Run <code>npm run harness:score</code> to refresh.
                </div>
            )}
            <AdminClient report={report} />
        </>
    )
}
