import { parseMigrationInput, type CollectionReport } from './pw1-collection-input'
import type { BatchEntry } from './pw1-batch-input'
export type InvalidStore = { inputIndex: number; sourceStoreId?: string; error: string; stage: 'validation' }
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
/** Broken entries do not prevent unrelated stores from running. Ambiguous identities fail closed. */
export function validateMigrationBatch(input: unknown) {
    if (!Array.isArray(input) || !input.length) throw new Error('Input must be a nonempty JSON array')
    const candidates: Array<{ entry: BatchEntry; reports: CollectionReport[]; inputIndex: number }> = []
    const errors: InvalidStore[] = []
    const identities: Array<{ inputIndex: number; storeId?: string }> = []
    let ordinal = 0
    for (const value of input) {
        const bundle = record(value)
        const parts = 'tenants' in bundle && Array.isArray(bundle.sites) && bundle.sites.length
            ? bundle.sites.map(site => ({ ...bundle, sites: [site] })) : [value]
        for (const part of parts) {
            const inputIndex = ordinal++
            const p = record(part)
            const site = Array.isArray(p.sites) ? record(p.sites[0]) : {}
            const tenant = Array.isArray(p.tenants) ? p.tenants.map(record).find(t => t._ref === site.tenant) : undefined
            let metadata = tenant?.metaData
            if (typeof metadata === 'string') { try { metadata = JSON.parse(metadata) } catch { metadata = null } }
            const rawId = p.sourceStoreId ?? record(metadata).pw1StoreId
            const storeId = /^\d+$/.test(String(rawId)) ? String(rawId) : undefined
            identities.push({ inputIndex, storeId })
            try {
                const parsed = parseMigrationInput([part])
                if (parsed.entries.length !== 1) throw new Error('Expected exactly one source store')
                identities[identities.length - 1].storeId = parsed.entries[0].sourceStoreId
                candidates.push({ entry: parsed.entries[0], reports: parsed.reports, inputIndex })
            } catch (error) { errors.push({ inputIndex, sourceStoreId: storeId, error: error instanceof Error ? error.message : 'Invalid store', stage: 'validation' }) }
        }
    }
    const rejected = new Map<number, string>()
    const duplicates = new Map<string, number[]>()
    for (const i of identities) if (i.storeId) duplicates.set(i.storeId, [...(duplicates.get(i.storeId) ?? []), i.inputIndex])
    for (const [id, indexes] of duplicates) if (indexes.length > 1) for (const index of indexes) rejected.set(index, `Duplicate source store ${id}`)
    const users = new Map<string, typeof candidates>(), emails = new Map<string, typeof candidates>()
    for (const candidate of candidates) {
        users.set(candidate.entry.sourceUserId, [...(users.get(candidate.entry.sourceUserId) ?? []), candidate])
        emails.set(candidate.entry.owner.email, [...(emails.get(candidate.entry.owner.email) ?? []), candidate])
    }
    for (const group of users.values()) if (new Set(group.map(c => JSON.stringify(c.entry.owner))).size > 1) for (const c of group) rejected.set(c.inputIndex, 'Conflicting source owner identity')
    for (const group of emails.values()) if (new Set(group.map(c => c.entry.sourceUserId)).size > 1) for (const c of group) rejected.set(c.inputIndex, 'Different source users share destination email')
    for (const field of ['tenantId','siteId'] as const) {
        const destinations = new Map<number, typeof candidates>()
        for (const candidate of candidates) {
            const id = candidate.entry.destination?.[field]
            if (id) destinations.set(id, [...(destinations.get(id) ?? []), candidate])
        }
        for (const group of destinations.values()) if (group.length > 1) for (const c of group) rejected.set(c.inputIndex, `Different source stores share destination ${field}`)
    }
    const accepted = candidates.filter(c => {
        const error = rejected.get(c.inputIndex)
        if (!error) return true
        errors.push({ inputIndex: c.inputIndex, sourceStoreId: c.entry.sourceStoreId, error, stage: 'validation' }); return false
    })
    return { entries: accepted.map(c => c.entry), reports: accepted.flatMap(c => c.reports), errors }
}
