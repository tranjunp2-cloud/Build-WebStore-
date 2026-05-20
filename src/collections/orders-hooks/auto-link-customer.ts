import type { CollectionBeforeChangeHook } from 'payload'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * beforeChange hook — upsert Customer by (tenant_id, lower(trim(email))) and set data.customer.
 *
 * Non-throwing: entire body is wrapped in try/catch.
 * On any failure: logs error + sets data.customer = null, order creation continues.
 *
 * Idempotent: same email + tenant repeated N times yields ONE customer row
 * (DB UNIQUE INDEX on customers(tenant_id, LOWER(TRIM(email))) from phase-02 is the safety net).
 */
export const autoLinkCustomer: CollectionBeforeChangeHook = async ({
    data,
    req,
    operation,
    originalDoc,
}) => {
    try {
        const emailRaw: string = data.customerEmail ?? ''

        // On update, skip if customerEmail unchanged (perf — avoid unnecessary DB roundtrip)
        if (operation === 'update' && originalDoc?.customerEmail === emailRaw) {
            return data
        }

        const email = String(emailRaw).trim().toLowerCase()

        // Empty or invalid email → null FK, no error
        if (!email || !EMAIL_REGEX.test(email)) {
            data.customer = null
            return data
        }

        // Resolve tenantId from relationship (populated object or raw id)
        const tenantId =
            typeof data.tenant === 'object' && data.tenant !== null
                ? (data.tenant as { id: string | number }).id
                : data.tenant

        if (!tenantId) {
            data.customer = null
            return data
        }

        // Look up existing customer by (tenant, normalised email)
        const found = await req.payload.find({
            collection: 'customers',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { email: { equals: email } },
                ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })

        if (found.docs[0]) {
            data.customer = found.docs[0].id
            return data
        }

        // No existing customer — create one (firstOrderAt set once, never updated)
        const created = await req.payload.create({
            collection: 'customers',
            data: {
                tenant: tenantId,
                email,
                name: data.customerName || '(unknown)',
                phone: data.customerPhone ?? null,
                firstOrderAt: new Date().toISOString(),
            },
            overrideAccess: true,
            depth: 0,
        })

        data.customer = created.id
        return data
    } catch (err) {
        // Non-throwing: log (no PII — email/name/phone excluded) and continue
        console.error('[Orders.autoLinkCustomer] failed', err)
        data.customer = null
        return data
    }
}
