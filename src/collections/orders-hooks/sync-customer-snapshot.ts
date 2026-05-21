import type { CollectionAfterChangeHook } from 'payload'

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
            doc.customerPhone !== previousDoc?.customerPhone

        if (!changed) return doc

        await req.payload.update({
            collection: 'customers',
            id: customerId as string,
            data: {
                name: doc.customerName,
                phone: doc.customerPhone ?? null,
            },
            overrideAccess: true,
            depth: 0,
        })
    } catch (err) {
        // Non-throwing: log (no PII) and continue
        console.error('[Orders.syncCustomerSnapshot] failed', err)
    }

    return doc
}
