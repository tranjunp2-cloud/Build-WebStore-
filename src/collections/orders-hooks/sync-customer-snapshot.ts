import type { CollectionAfterChangeHook } from 'payload'
import { normalizePhone } from '@/lib/normalize-phone'
import { runAfterResponse } from '@/lib/runtime/run-after-response'

/**
 * afterChange hook — keep Customer.phone and latestOrderAt in sync with the order.
 * name/email are NOT written here (#2086): a later order with the same phone must not overwrite the
 * customer's name/email. autoLinkCustomer sets them on create and fills them when the customer has none.
 *
 * Runs only when:
 *   - operation === 'create'  (always sync on first order)
 *   - OR customerPhone differs from previousDoc (name/email edits on an order don't touch the customer)
 *
 * Non-throwing: entire body wrapped in try/catch; logs on error; never rethrows.
 * No recursion risk: customers collection has no afterChange hook (phase-02 design).
 *
 * The customer write runs after the response (after the order transaction commits) and is never
 * awaited here. Awaiting it deadlocks checkout: the order INSERT holds a FOR KEY SHARE lock on the
 * customer row (FK), and Payload's array-aware update (`insert … on conflict ("id") do update set
 * "id" = …`) needs FOR UPDATE on that row from another connection, which waits for the order
 * transaction, which waits for this hook. Passing `req` instead would join the order transaction,
 * but then a failed customer write rolls the whole order back (Payload kills the shared
 * transaction) while this hook swallows the error, so the order would silently be lost.
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
            doc.customerPhone !== previousDoc?.customerPhone

        if (!changed) return doc

        const normPhone = normalizePhone(doc.customerPhone)

        // phone: only set when non-null (guard against wiping identity key via phone-less order update)
        const updateData: Record<string, unknown> = {}
        if (normPhone !== null) updateData.phone = normPhone

        // Only set latestOrderAt on create — editing an old order would regress the date backwards
        if (doc.createdAt && operation === 'create') updateData.latestOrderAt = doc.createdAt

        // Do not capture `req` in the task: it outlives the request/transaction.
        const payload = req.payload
        runAfterResponse('Orders.syncCustomerSnapshot', () =>
            payload
                .update({
                    collection: 'customers',
                    id: customerId as string,
                    data: updateData,
                    overrideAccess: true,
                    depth: 0,
                })
                .catch((err) => console.error('[Orders.syncCustomerSnapshot] failed', err)),
        )
    } catch (err) {
        // Non-throwing: log (no PII) and continue
        console.error('[Orders.syncCustomerSnapshot] failed', err)
    }

    return doc
}
