/**
 * QC functional enrichment — adds CMS setup to first N QC tenants so QA
 * can test the full merchant admin flow (payments, shipping, orders,
 * customers, discounts) without hand-configuring each tenant.
 *
 * Runs AFTER `seed-qc-data.ts` populates users + tenants + sites + products.
 * Only touches the first `QC_FUNCTIONAL_COUNT` tenants (default 10) —
 * the rest stay bare so load-test scenarios still exercise fresh tenants.
 *
 * Idempotent: skips existing customers (email match), orders (orderNumber
 * match), discount codes (code match). Payment/shipping toggles just
 * re-set the same booleans.
 *
 * Usage:
 *   npm run qc:seed-functional            # 10 tenants get full setup
 *   QC_FUNCTIONAL_COUNT=5 npm run qc:seed-functional
 */

import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'
import { assertQcEnv } from './qc-guard'

const FUNCTIONAL_COUNT = clamp(Number(process.env.QC_FUNCTIONAL_COUNT ?? 10), 1, 50)

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n) || n < lo) return lo
  if (n > hi) return hi
  return Math.floor(n)
}

async function enablePaymentAndShipping(payload: Payload, tenantId: number, siteId: number): Promise<void> {
  // Tenant-level: turn on Cash on Delivery — no Stripe Connect needed.
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { payments: { payment_cod: true } } as never,
    overrideAccess: true,
  })
  // Site-level: enable shipping with a free-shipping threshold that
  // covers 90% of test orders so QA can exercise both fee + free paths.
  await payload.update({
    collection: 'sites',
    id: siteId,
    data: {
      shippingConfig: {
        enabled: true,
        freeShippingThresholdSen: 20000, // RM 200
        shippingSetupConfirmed: true,
      },
    } as never,
    overrideAccess: true,
  })
}

interface CustomerSnapshot {
  id: number
  email: string
  name: string
  phone: string
}

async function seedCustomers(
  payload: Payload,
  tenantId: number,
  tenantIdx: number,
): Promise<CustomerSnapshot[]> {
  const snapshots: CustomerSnapshot[] = []
  for (let i = 1; i <= 3; i++) {
    const email = `customer-${tenantIdx}-${i}@qc.primeweb.local`
    const name = `Customer ${tenantIdx}-${i}`
    const phone = `+60123456${String(tenantIdx * 10 + i).padStart(3, '0')}`
    const existing = await payload.find({
      collection: 'customers',
      where: { and: [{ tenant: { equals: tenantId } }, { email: { equals: email } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) {
      snapshots.push({ id: existing.docs[0].id as number, email, name, phone })
      continue
    }
    const created = await payload.create({
      collection: 'customers',
      data: {
        tenant: tenantId,
        email,
        name,
        phone,
        rank: (['bronze', 'silver', 'gold'] as const)[i - 1],
      } as never,
      overrideAccess: true,
    })
    snapshots.push({ id: created.id as number, email, name, phone })
  }
  return snapshots
}

const ORDER_STATUS_MIX: Array<{ status: string; paymentStatus: string; paymentMethod: string }> = [
  { status: 'pending', paymentStatus: 'awaiting_payment', paymentMethod: 'cod' },
  { status: 'paid', paymentStatus: 'paid', paymentMethod: 'cod' },
  { status: 'shipped', paymentStatus: 'paid', paymentMethod: 'cod' },
  { status: 'completed', paymentStatus: 'paid', paymentMethod: 'cod' },
  { status: 'cancelled', paymentStatus: 'cancelled', paymentMethod: 'cod' },
]

async function seedOrders(
  payload: Payload,
  tenantId: number,
  siteId: number,
  customers: CustomerSnapshot[],
  productIds: number[],
  tenantIdx: number,
): Promise<number> {
  if (!productIds.length || !customers.length) return 0
  let created = 0
  for (let i = 0; i < ORDER_STATUS_MIX.length; i++) {
    const orderNumber = `QC-T${tenantIdx}-O${i + 1}`
    const existing = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: orderNumber } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) continue
    const mix = ORDER_STATUS_MIX[i]
    const product = productIds[i % productIds.length]
    const buyer = customers[i % customers.length]
    const unitPrice = 5000 + i * 1000 // RM 50, 60, 70, 80, 90 in sen
    const quantity = 1 + (i % 3)
    const subtotal = unitPrice * quantity
    const shippingFee = subtotal >= 20000 ? 0 : 1000 // free above RM 200, else RM 10
    await payload.create({
      collection: 'orders',
      data: {
        tenant: tenantId,
        site: siteId,
        orderNumber,
        items: [{ product, productName: `Product ${i + 1}`, quantity, unitPrice }],
        subtotal,
        shippingFee,
        tax: 0,
        total: subtotal + shippingFee,
        currency: 'MYR',
        locale: 'en',
        status: mix.status,
        paymentStatus: mix.paymentStatus,
        paymentMethod: mix.paymentMethod,
        customerEmail: buyer.email,
        customerName: buyer.name,
        customerPhone: buyer.phone,
        customer: buyer.id,
      } as never,
      overrideAccess: true,
    })
    created++
  }
  return created
}

async function seedDiscounts(payload: Payload, tenantId: number, siteId: number, tenantIdx: number): Promise<number> {
  const codes = [
    { code: `QC${tenantIdx}PCT10`, type: 'percentage', value: 10, description: '10% off (QC test)' },
    { code: `QC${tenantIdx}FIX50`, type: 'fixed', value: 5000, description: 'RM 50 off (QC test)' },
  ]
  let created = 0
  for (const spec of codes) {
    const existing = await payload.find({
      collection: 'discounts',
      where: { code: { equals: spec.code } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) continue
    await payload.create({
      collection: 'discounts',
      data: { tenant: tenantId, site: siteId, ...spec, status: 'active' } as never,
      overrideAccess: true,
    })
    created++
  }
  return created
}

async function main(): Promise<void> {
  assertQcEnv()
  const t0 = Date.now()
  const payload = await getPayload({ config })

  console.log(`🎨 Enriching first ${FUNCTIONAL_COUNT} tenants with full CMS setup...`)

  // Fetch tenants by exact slug qc-shop-1..N — avoids the alphabetical
  // sort trap where "qc-shop-10" would come before "qc-shop-2".
  let customers = 0, orders = 0, discounts = 0
  let processed = 0
  for (let tenantIdx = 1; tenantIdx <= FUNCTIONAL_COUNT; tenantIdx++) {
    const tenantResult = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: `qc-shop-${tenantIdx}` } },
      limit: 1,
      overrideAccess: true,
    })
    if (!tenantResult.docs.length) {
      console.warn(`  ! qc-shop-${tenantIdx}: tenant not found — skip`)
      continue
    }
    const tenant = tenantResult.docs[0]
    const tenantId = tenant.id as number
    processed++

    const sites = await payload.find({
      collection: 'sites',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      overrideAccess: true,
    })
    if (!sites.docs.length) { console.warn(`  ! tenant ${tenantIdx}: no site — skip`); continue }
    const siteId = sites.docs[0].id as number

    const products = await payload.find({
      collection: 'products',
      where: { tenant: { equals: tenantId } },
      limit: 10,
      overrideAccess: true,
    })
    const productIds = products.docs.map((p) => p.id as number)

    await enablePaymentAndShipping(payload, tenantId, siteId)
    const customerSnapshots = await seedCustomers(payload, tenantId, tenantIdx)
    customers += customerSnapshots.length
    orders += await seedOrders(payload, tenantId, siteId, customerSnapshots, productIds, tenantIdx)
    discounts += await seedDiscounts(payload, tenantId, siteId, tenantIdx)
    console.log(`  ✓ tenant ${tenantIdx} (${tenant.name}): payment+shipping on, ${customerSnapshots.length} customers, orders + discounts`)
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`✅ Functional enrichment done in ${elapsed}s. Totals: ${customers} customers, ${orders} orders, ${discounts} discounts across ${processed} tenants.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Functional seed failed:', err)
  process.exit(1)
})
