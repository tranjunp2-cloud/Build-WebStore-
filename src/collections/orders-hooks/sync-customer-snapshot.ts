import type { CollectionAfterChangeHook } from 'payload'
import { normalizePhone } from '@/lib/normalize-phone'

/**
 * afterChange hook — keep Customer.name / Customer.phone in sync with the latest order snapshot.
 *
 * Runs only when:
 *   - operation === 'create'  (always sync on first order)
 *   - OR customerName / customerPhone differ from previousDoc (latest-wins policy)
 *
 * Non-throwing: entire body wrapped in try/catch; logs on error; never rethrows.
 * No recursion risk: customers collection has no afterChange hook (phase-02 design).
 */
export const syncCustomerSnapshot: CollectionAfterChangeHook = async ({
    doc,
    previousDoc,
    operation,
    req,
}) => {
    try {
        const customerId =
            typeof doc.customer === 'object' && doc.customer !== null
                ? (doc.customer as { id: string | number }).id
                : doc.customer

        if (!customerId) return doc

        const changed =
            operation === 'create' ||
            doc.customerName !== previousDoc?.customerName ||
            doc.customerPhone !== previousDoc?.customerPhone ||
            doc.customerEmail !== previousDoc?.customerEmail

        if (!changed) return doc

        const normPhone = normalizePhone(doc.customerPhone)

        // Build update payload conservatively:
        // - name: only set when non-empty (guard against clearing customer name via blank order field)
        // - phone: only set when non-null (guard against wiping identity key via phone-less order update)
        const updateData: Record<string, unknown> = {}
        if (doc.customerName) updateData.name = doc.customerName
        if (normPhone !== null) updateData.phone = normPhone

        // Sync email if present and valid format
        const rawEmail = String(doc.customerEmail ?? '').trim().toLowerCase()
        if (rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
            updateData.email = rawEmail
        }

        // Only set latestOrderAt on create — editing an old order would regress the date backwards
        if (doc.createdAt && operation === 'create') updateData.latestOrderAt = doc.createdAt

        await req.payload.update({
            collection: 'customers',
            id: customerId as string,
            data: updateData,
            overrideAccess: true,
            depth: 0,
        })
    } catch (err) {
        // Non-throwing: log (no PII) and continue
        console.error('[Orders.syncCustomerSnapshot] failed', err)
    }

    return doc
}
