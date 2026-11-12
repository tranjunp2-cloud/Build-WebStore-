import type { CollectionBeforeChangeHook } from 'payload'
import { normalizePhone } from '@/lib/normalize-phone'
import { runAfterResponse } from '@/lib/runtime/run-after-response'
import { isPoolAcquireTimeout } from '@/lib/db/pool-errors'

// Connection-class failures: the pool could not hand out a connection, or the server dropped it.
// pg SQLSTATE class 08 = connection exception; 57P01..03 = admin/crash shutdown, cannot connect now;
// 53300 = too many connections.
const CONNECTION_ERROR_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', '53300', '57P01', '57P02', '57P03'])
const CONNECTION_ERROR_MESSAGES = ['connection terminated', 'connection timeout', 'cannot use a pool after calling end']

/** True when `error` (or its cause chain) means "no database connection", not "bad data". */
export function isDbConnectionError(error: unknown): boolean {
    if (isPoolAcquireTimeout(error)) return true
    let current: unknown = error
    for (let depth = 0; current && depth < 5; depth++) {
        const code = String((current as { code?: unknown }).code ?? '')
        if (CONNECTION_ERROR_CODES.has(code) || code.startsWith('08')) return true
        const message = (current instanceof Error ? current.message : '').toLowerCase()
        if (CONNECTION_ERROR_MESSAGES.some((m) => message.includes(m))) return true
        current = (current as { cause?: unknown }).cause
    }
    return false
}

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
 * DB safety net: UNIQUE INDEX customers_tenant_phone_uniq on (tenant_id, LOWER(TRIM(phone))) WHERE phone IS NOT NULL.
 * Phone normalization: see src/lib/normalize-phone.ts (strips +/-/()/./spaces before storage).
 *
 * Transactions (drizzle 0.45 runs the order write in a real transaction that holds one pool connection):
 *   - The customer lookups pass `req`, so they run on the order's own connection. A lookup without
 *     `req` needed a second connection while the first was held; when the pool was exhausted it
 *     waited the connect timeout and the order was saved with customer = null.
 *   - The customer create stays off `req`: a unique violation inside the order transaction would
 *     abort it. It still needs a second connection.
 *
 * Errors:
 *   - A failed lookup throws: Payload has already rolled the order transaction back, so carrying on
 *     would write the order outside it.
 *   - A create that fails for lack of a connection (pool timeout, dropped connection) throws: the
 *     order rolls back and checkout returns an error the buyer can retry. It is never saved as
 *     "no customer". Retrying here would hold the order's connection for another connect timeout
 *     while the pool is already exhausted.
 *   - Any other create failure (bad data) is logged and the order is saved with customer = null.
 */
export const autoLinkCustomer: CollectionBeforeChangeHook = async ({
    data,
    req,
    operation,
    originalDoc,
}) => {
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
        req,
    })

    if (found.docs[0]) {
        const existing = found.docs[0] as { id: number | string; name?: string | null; email?: string | null }
        data.customer = existing.id

        // Fill name/email only when the customer has none (#2086): a later order with the same phone
        // but another name/email must not overwrite what the shop already holds. Addresses are not
        // touched either — address management belongs to updateShopCustomerAction.
        const updateData: Record<string, unknown> = {}
        const hasName = Boolean(existing.name) && existing.name !== '(unknown)'
        if (!hasName && data.customerName) updateData.name = data.customerName
        if (!existing.email && validEmail) updateData.email = validEmail
        if (Object.keys(updateData).length === 0) return data

        // Best-effort, after the response (not awaited, no `req`): in a bulk order update an
        // earlier order of the same transaction already points at this customer, so its FK holds
        // a KEY SHARE lock that Payload's customer update (FOR UPDATE via `on conflict ("id")`)
        // waits on from another connection, while the order transaction waits for this hook.
        const payload = req.payload
        runAfterResponse('Orders.autoLinkCustomer', () =>
            payload
                .update({
                    collection: 'customers',
                    id: existing.id,
                    data: updateData,
                    overrideAccess: true,
                    depth: 0,
                })
                .catch((updErr) => console.error('[Orders.autoLinkCustomer] customer update failed', updErr)),
        )
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
        if (isDbConnectionError(createErr)) {
            console.error('[Orders.autoLinkCustomer] no database connection for the customer create; order not saved', createErr)
            throw createErr
        }
        // Concurrent order with same phone hit the unique index — retry find to get the winner.
        // Check Postgres error code 23505 first (reliable), then fall back to message string match
        // for Payload-adapter-wrapped errors that may not expose code directly.
        const msg = String((createErr as Error).message ?? '').toLowerCase()
        const errRecord = createErr as Record<string, unknown>
        const causeRecord = errRecord.cause as Record<string, unknown> | undefined
        const pgCode = (errRecord.code ?? causeRecord?.code) as string | undefined
        // Payload's drizzle adapter (handleUpsertError) turns 23505 into a ValidationError
        // ("The following field is invalid: …") without the pg code; its field errors carry the
        // constraint's `tableName` and a (translated) "Value must be unique" message.
        const fieldErrors = (errRecord.data as { errors?: Array<{ message?: unknown; tableName?: unknown }> } | undefined)?.errors ?? []
        const isPayloadUniqueError = fieldErrors.some((e) => Boolean(e?.tableName) || /unique/i.test(String(e?.message ?? '')))
        const isUniqueViolation = pgCode === '23505' || isPayloadUniqueError || msg.includes('unique') || msg.includes('duplicate')
        if (isUniqueViolation) {
            const retry = await req.payload.find({
                collection: 'customers',
                where: { and: [{ tenant: { equals: tenantId } }, { phone: { equals: normPhone } }] },
                limit: 1,
                depth: 0,
                overrideAccess: true,
                req,
            })
            if (retry.docs[0]) {
                data.customer = (retry.docs[0] as { id: number | string }).id
            } else {
                console.error('[Orders.autoLinkCustomer] unique violation but no existing customer found', createErr)
                data.customer = null
            }
        } else {
            // Bad data (not a connection problem): keep the order, without a customer link.
            console.error('[Orders.autoLinkCustomer] customer create failed', createErr)
            data.customer = null
        }
    }

    return data
}
