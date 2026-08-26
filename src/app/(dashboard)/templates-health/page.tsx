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
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table'
import { TableEmptyState } from '@/components/ui/table-empty-state'
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
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--dash-text)' }}>Templates Health</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--dash-text-muted)' }}>
                        Drift state for DB templates vs live block registry. Total: {summary.total} · OK: {summary.ok} · Warn: {summary.warn} · Broken: {summary.broken}
                    </p>
                </div>
                <DriftActions />
            </div>

            {rows.length === 0 ? (
                <TableEmptyState
                    title="No templates in DB"
                    subtitle="Click &quot;Re-seed templates&quot; to populate."
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Pages</TableHead>
                            <TableHead>Drift</TableHead>
                            <TableHead>Findings</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell style={{ color: 'var(--dash-text)' }}>{r.name}</TableCell>
                                <TableCell style={{ color: 'var(--dash-text-muted)' }}>{r.category}</TableCell>
                                <TableCell style={{ color: 'var(--dash-text-muted)' }}>{r.pagesCount}</TableCell>
                                <TableCell>
                                    <Badge variant={badgeVariant(r.status)} dot className="rounded-full">
                                        {badgeLabel(r.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell style={{ color: 'var(--dash-text-muted)' }}>{r.findings.length}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}
