/**
 * Templates Health dashboard — surface drift state of DB-seeded templates.
 *
 * Plan: plans/260419-2022-GH-1-harness-template-block-sync-flow/phase-04-admin-harness-ui.md
 * Drift API: src/lib/ai/template-drift-validator.ts (Phase 02)
 *
 * Super-admin only (uses layout auth; double-checked here via redirect).
 */

import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { scanDbTemplates, type DriftFinding } from '@/lib/ai/template-drift-validator'
import { Badge } from '@/components/ui/badge'
import { DriftActions } from './drift-actions.client'

export const dynamic = 'force-dynamic'

type BadgeStatus = 'green' | 'yellow' | 'red'

function computeBadge(findings: DriftFinding[]): BadgeStatus {
    if (findings.length === 0) return 'green'
    const hasBroken = findings.some(
        (f) =>
            f.issue === 'unknown-block' ||
            (f.issue === 'schema-drift' && (f.zodIssues?.length ?? 0) > 0),
    )
    if (hasBroken) return 'red'
    return 'yellow' // only unknown-variant or stale-version
}

function badgeVariant(status: BadgeStatus): 'success' | 'warning' | 'destructive' {
    if (status === 'green') return 'success'
    if (status === 'yellow') return 'warning'
    return 'destructive'
}

function badgeLabel(status: BadgeStatus): string {
    if (status === 'green') return 'OK'
    if (status === 'yellow') return 'Warn'
    return 'Broken'
}

export default async function TemplatesHealthPage() {
    const user = await getCurrentUser()
    const roles = (user as unknown as { roles?: string[] } | null)?.roles ?? []
    if (!roles.includes('super-admin')) redirect('/dashboard')

    const payload = await getPayload({ config })
    const { docs } = await payload.find({
        collection: 'templates',
        limit: 500,
        depth: 0,
    })

    const findings = await scanDbTemplates(payload)
    const findingsByTemplate = new Map<string, DriftFinding[]>()
    for (const f of findings) {
        // Strip :slug suffix so findings group under the root template id.
        const rootId = f.templateId.split(':')[0] ?? f.templateId
        const list = findingsByTemplate.get(rootId) ?? []
        list.push(f)
        findingsByTemplate.set(rootId, list)
    }

    const rows = docs.map((doc) => {
        const record = doc as unknown as {
            id: string | number
            name?: string
            category?: string[] | string
            templatePages?: Array<unknown>
        }
        const id = String(record.id)
        const templateFindings = findingsByTemplate.get(id) ?? []
        const status = computeBadge(templateFindings)
        const pagesCount = Array.isArray(record.templatePages) ? record.templatePages.length : 0
        const categoryLabel = Array.isArray(record.category)
            ? record.category.join(', ')
            : String(record.category ?? '—')
        return { id, name: record.name ?? id, category: categoryLabel, pagesCount, status, findings: templateFindings }
    })

    const summary = {
        total: rows.length,
        broken: rows.filter((r) => r.status === 'red').length,
        warn: rows.filter((r) => r.status === 'yellow').length,
        ok: rows.filter((r) => r.status === 'green').length,
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Templates Health</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        Drift state for DB templates vs live block registry. Total: {summary.total} · OK: {summary.ok} · Warn: {summary.warn} · Broken: {summary.broken}
                    </p>
                </div>
                <DriftActions />
            </div>

            <div className="rounded-lg border border-white/10 bg-[#0F172A] overflow-hidden">
                {rows.length === 0 ? (
                    <p className="p-6 text-sm text-gray-400">No templates in DB. Click “Re-seed templates” to populate.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 text-gray-400">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium">Name</th>
                                <th className="text-left px-4 py-3 font-medium">Category</th>
                                <th className="text-left px-4 py-3 font-medium">Pages</th>
                                <th className="text-left px-4 py-3 font-medium">Drift</th>
                                <th className="text-left px-4 py-3 font-medium">Findings</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-200">
                            {rows.map((r) => (
                                <tr key={r.id} className="hover:bg-white/5">
                                    <td className="px-4 py-3">{r.name}</td>
                                    <td className="px-4 py-3 text-gray-400">{r.category}</td>
                                    <td className="px-4 py-3 text-gray-400">{r.pagesCount}</td>
                                    <td className="px-4 py-3"><Badge variant={badgeVariant(r.status)}>{badgeLabel(r.status)}</Badge></td>
                                    <td className="px-4 py-3 text-gray-400">{r.findings.length}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
