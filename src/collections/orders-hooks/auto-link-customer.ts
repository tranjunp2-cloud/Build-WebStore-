import type { CollectionBeforeChangeHook } from 'payload'
import { normalizePhone } from '@/lib/normalize-phone'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type OrderShippingAddress = {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postcode?: string | null
    country?: string | null
}

// Build a Customers.addresses[] entry from an order shippingAddress group.
// Returns null when line1 is empty (line1 is required on the array field).
function buildAddressFromShipping(
    sa: OrderShippingAddress | undefined | null,
): Record<string, unknown> | null {
    const line1 = String(sa?.line1 ?? '').trim()
    if (!line1) return null
    return {
        line1,
        ...(sa?.line2 ? { line2: String(sa.line2) } : {}),
        ...(sa?.city ? { city: String(sa.city) } : {}),
        ...(sa?.state ? { state: String(sa.state) } : {}),
        ...(sa?.postcode ? { postcode: String(sa.postcode) } : {}),
        country: sa?.country ? String(sa.country) : 'Malaysia',
        isDefault: true,
    }
}

/**
 * beforeChange hook — upsert Customer by (tenant_id, phone) and set data.customer.
 *
 * Identity key: same phone under same tenant → same customer row.
 * Phone absent → data.customer = null (silent skip; phone is required at checkout).
 * Non-throwing: entire body is wrapped in try/catch.
 * On any failure: logs error + sets data.customer = null, order creation continues.
 * DB safety net: UNIQUE INDEX customers_tenant_phone_uniq on (tenant_id, LOWER(TRIM(phone))) WHERE phone IS NOT NULL.
 * Phone normalization: see src/lib/normalize-phone.ts (strips +/-/()/./spaces before storage).
 */
export const autoLinkCustomer: CollectionBeforeChangeHook = async ({
    data,
    req,
    operation,
    originalDoc,
}) => {
    try {
        const phoneRaw: string = data.customerPhone ?? ''
        const normPhone = normalizePhone(phoneRaw)

        // On update, skip if normalized phone unchanged (perf — avoid unnecessary DB roundtrip)
        if (operation === 'update' && normalizePhone(originalDoc?.customerPhone) === normPhone) {
            return data
        }

        // No phone → null FK, no error
        if (!normPhone) {
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

        // Process email + address upfront (used in both found and create paths)
        const emailRaw = String(data.customerEmail ?? '').trim().toLowerCase()
        const validEmail = emailRaw && EMAIL_REGEX.test(emailRaw) ? emailRaw : null
        const addr = buildAddressFromShipping(data.shippingAddress as OrderShippingAddress)

        // Look up existing customer by (tenant, normalised phone)
        const found = await req.payload.find({
            collection: 'customers',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { phone: { equals: normPhone } },
                ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })

        if (found.docs[0]) {
            const existing = found.docs[0] as { id: number | string; name?: string }
            data.customer = existing.id

            // Update name/email only — address management belongs to updateShopCustomerAction.
            // Overwriting addresses here would destroy CRM-curated address history.
            const updateData: Record<string, unknown> = {
                name: data.customerName || existing.name || '(unknown)',
            }
            if (validEmail) updateData.email = validEmail

            try {
                await req.payload.update({
                    collection: 'customers',
                    id: existing.id,
                    data: updateData,
                    overrideAccess: true,
                    depth: 0,
                })
            } catch (updErr) {
                // Update is best-effort; keep the customer link, continue order save
                console.error('[Orders.autoLinkCustomer] customer update failed', updErr)
            }
            return data
        }

        try {
            const created = await req.payload.create({
                collection: 'customers',
                data: {
                    tenant: tenantId,
                    name: data.customerName || '(unknown)',
                    phone: normPhone,
                    ...(validEmail ? { email: validEmail } : {}),
                    firstOrderAt: new Date().toISOString(),
                    ...(addr ? { addresses: [addr] } : {}),
                },
                overrideAccess: true,
                depth: 0,
            })
            data.customer = created.id
        } catch (createErr) {
            // Concurrent order with same phone hit the unique index — retry find to get the winner.
            // Check Postgres error code 23505 first (reliable), then fall back to message string match
            // for Payload-adapter-wrapped errors that may not expose code directly.
            const msg = String((createErr as Error).message ?? '').toLowerCase()
            const errRecord = createErr as Record<string, unknown>
            const causeRecord = errRecord.cause as Record<string, unknown> | undefined
            const pgCode = (errRecord.code ?? causeRecord?.code) as string | undefined
            const isUniqueViolation = pgCode === '23505' || msg.includes('unique') || msg.includes('duplicate')
            if (isUniqueViolation) {
                const retry = await req.payload.find({
                    collection: 'customers',
                    where: { and: [{ tenant: { equals: tenantId } }, { phone: { equals: normPhone } }] },
                    limit: 1,
                    depth: 0,
                    overrideAccess: true,
                })
                if (retry.docs[0]) {
                    data.customer = (retry.docs[0] as { id: number | string }).id
                } else {
                    throw createErr
                }
            } else {
                throw createErr
            }
        }

        return data
    } catch (err) {
        // Non-throwing: log (no PII — phone/name excluded) and continue
        console.error('[Orders.autoLinkCustomer] failed', err)
        data.customer = null
        return data
    }
}
