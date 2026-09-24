import { sourceTimestamps } from './pw2-commerce-reconciliation.mjs'
import * as phoneUtility from '../normalize-phone.ts'

// tsx exposes this shared TS module as CJS on Node 20; native TS loading exposes ESM.
// Keep the same runtime function in both cases, without duplicating its identity rule.
const normalizePhone = phoneUtility.normalizePhone ?? phoneUtility.default?.normalizePhone
if (typeof normalizePhone !== 'function') throw new Error('Shared normalizePhone utility is unavailable')

const id = v => String(v ?? '')
const present = v => v !== undefined && v !== null && String(v).trim() !== ''
const live = r => !present(r.deleted_at)
const compareId = (a, b) => /^\d+$/.test(id(a)) && /^\d+$/.test(id(b)) ? (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0) : id(a).localeCompare(id(b))
// Reuse the exact runtime phone identity rule.
export const normalizeCustomerPhone = normalizePhone
function index(rows, name) {
  const result = new Map()
  for (const row of rows ?? []) {
    if (!present(row.id) || result.has(id(row.id))) throw new Error(`Invalid/duplicate ${name} identity`)
    result.set(id(row.id), row)
  }
  return result
}
const sourceId = ref => id(ref).split(':').at(-1)
const email = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id(v).trim()) ? id(v).trim().toLowerCase() : undefined

/** Offline research artifact reconciliation. Never writes DB or changes order snapshots. */
export function reconcileCustomers(store, storeId, tables, { utcOffset }) {
  const output = structuredClone(store)
  const maps = Object.fromEntries(['customers', 'orders', 'addresses', 'ranks', 'countries', 'provinces', 'districts', 'wards'].map(k => [k, index(tables[k], k)]))
  const owned = row => row && id(row.store_id) === id(storeId)
  const rows = [...maps.customers.values()].filter(owned)
  const orders = [...maps.orders.values()].filter(owned)
  const diagnostics = { customerCrosswalk: [], addressDispositions: [], rankConflicts: [], rankDispositions: [], profileConflicts: [] }
  // Never archive another tenant's address content through a corrupt reference.
  const archive = { targetCustomers: structuredClone(store.customers ?? []), customers: structuredClone(rows), ranks: structuredClone([...maps.ranks.values()].filter(owned)), addresses: structuredClone([...maps.addresses.values()].filter(owned)), orderRelations: orders.map(o => ({ id: o.id, store_id: o.store_id, customer_id: o.customer_id, shipping_address_id: o.shipping_address_id, billing_address_id: o.billing_address_id, created_at: o.created_at, updated_at: o.updated_at, deleted_at: o.deleted_at })) }
  for (const customer of output.customers ?? []) {
    const source = maps.customers.get(sourceId(customer._ref))
    if (!owned(source) || !live(source) || customer._ref !== `@customers:customers:${source.id}` || customer.tenant !== `@tenants:stores:${storeId}`) throw new Error('Target Customer identity/tenant mismatch')
  }
  const groups = new Map(), crosswalk = new Map()
  for (const row of rows) {
    if (!live(row)) { diagnostics.customerCrosswalk.push({ sourceCustomerId: id(row.id), disposition: 'deleted', targetRef: null }); continue }
    const dates = sourceTimestamps(row, utcOffset)
    const phone = normalizeCustomerPhone(row.phone)
    const key = phone ? `phone:${phone}` : `source:${row.id}`
    const group = groups.get(key) ?? []
    group.push({ row, dates, phone }); groups.set(key, group)
  }
  const resultCustomers = []
  const existingIds = new Set((output.customers ?? []).map(c => sourceId(c._ref)))
  const allIds = new Set(rows.filter(live).map(c => id(c.id)))
  const canonicalIds = new Set([...groups.values()].map(group => [...group].sort((a, b) => a.dates.createdAt.localeCompare(b.dates.createdAt) || compareId(a.row.id, b.row.id))[0].row.id).map(id))
  if (existingIds.size !== (output.customers ?? []).length || ![allIds, canonicalIds].some(ids => ids.size === existingIds.size && [...ids].every(v => existingIds.has(v)))) throw new Error('Incomplete Customer cohort')
  for (const group of groups.values()) {
    group.sort((a, b) => a.dates.createdAt.localeCompare(b.dates.createdAt) || compareId(a.row.id, b.row.id))
    const canonical = group[0], ref = `@customers:customers:${canonical.row.id}`
    const newest = [...group].sort((a, b) => b.dates.updatedAt.localeCompare(a.dates.updatedAt) || compareId(a.row.id, b.row.id))
    const name = newest.find(c => present(c.row.name))?.row.name?.trim()
    if (!name) throw new Error('Customer name missing')
    const customer = { _ref: ref, tenant: `@tenants:stores:${storeId}`, name, ...canonical.dates, updatedAt: newest[0].dates.updatedAt, addresses: [] }
    const selectedEmail = newest.map(c => email(c.row.email)).find(Boolean)
    if (selectedEmail) customer.email = selectedEmail
    if (canonical.phone) customer.phone = canonical.phone
    const notes = [...new Set(group.map(c => id(c.row.note).trim()).filter(Boolean))]
    if (notes.length) customer.notes = notes.join('\n\n')
    const rank = maps.ranks.get(id(canonical.row.rank_id))
    if (present(canonical.row.rank_id) && (!owned(rank) || !live(rank))) throw new Error('Canonical rank ownership/reference mismatch')
    const rankValue = { 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'vip' }[id(rank?.level)]
    if (rankValue) customer.rank = rankValue
    for (const member of group) {
      const sourceRank = maps.ranks.get(id(member.row.rank_id))
      const validRank = owned(sourceRank) && live(sourceRank) && ['1', '2', '3', '4'].includes(id(sourceRank.level))
      diagnostics.rankDispositions.push({ sourceCustomerId: id(member.row.id), sourceRankId: id(member.row.rank_id) || null, targetRef: ref, disposition: !present(member.row.rank_id) ? 'not-configured' : !validRank ? 'unmapped-rank' : member === canonical ? 'selected-canonical' : 'retained-source-only' })
    }
    const rankIds = [...new Set(group.map(c => id(c.row.rank_id)))]
    if (rankIds.length > 1) diagnostics.rankConflicts.push({ targetRef: ref, sourceCustomerIds: group.map(c => id(c.row.id)), sourceRankIds: rankIds, selectedSourceRankId: id(canonical.row.rank_id) || null, policy: 'canonical-oldest-created-at' })
    diagnostics.profileConflicts.push({ targetRef: ref, nameSourceId: id(newest.find(c => present(c.row.name))?.row.id), emailSourceId: id(newest.find(c => email(c.row.email))?.row.id), notesSourceIds: group.filter(c => present(c.row.note)).map(c => id(c.row.id)) })
    const memberIds = new Set(group.map(c => id(c.row.id)))
    const related = orders.filter(o => live(o) && memberIds.has(id(o.customer_id))).map(o => ({ row: o, dates: sourceTimestamps(o, utcOffset) }))
    related.sort((a, b) => b.dates.createdAt.localeCompare(a.dates.createdAt) || compareId(a.row.id, b.row.id))
    if (related.length) { customer.latestOrderAt = related[0].dates.createdAt; customer.firstOrderAt = related.at(-1).dates.createdAt }
    const locations = new Map(), selected = []
    const usages = related.flatMap(order => [['shipping_address_id', 'Shipping'], ['billing_address_id', 'Billing']]
      .map(([field, label]) => ({ order, field, label })))
    usages.sort((a, b) => b.order.dates.createdAt.localeCompare(a.order.dates.createdAt)
      || compareId(b.order.row[b.field], a.order.row[a.field])
      || compareId(b.order.row.id, a.order.row.id) || a.field.localeCompare(b.field))
    for (const { order, field, label } of usages) {
      if (!present(order.row[field])) continue
      const address = maps.addresses.get(id(order.row[field]))
      const disposition = { targetRef: ref, sourceOrderId: id(order.row.id), sourceAddressId: id(order.row[field]), usage: label }
      const country = maps.countries.get(id(address?.country_id)), province = maps.provinces.get(id(address?.province_id)), district = maps.districts.get(id(address?.district_id)), ward = maps.wards.get(id(address?.ward_id))
      disposition.legacyGeographyTypes = [['country', country], ['province', province], ['district', district], ['ward', ward]].filter(([, row]) => row && !live(row)).map(([type]) => type)
      const valid = owned(address) && live(address) && present(address.address) && country && present(country.name)
        && (!present(address.province_id) || (province && present(province.name) && id(province.country_id) === id(country.id)))
        && (!present(address.district_id) || (district && present(district.name) && id(district.province_id) === id(province?.id)))
        && (!present(address.ward_id) || (ward && present(ward.name) && id(ward.district_id) === id(district?.id)))
      if (!valid || !present(country?.name)) {
        const reason = !address ? 'ADDRESS_MISSING' : !owned(address) ? 'ADDRESS_CROSS_TENANT' : !live(address) ? 'ADDRESS_DELETED' : !present(address.address) ? 'ADDRESS_LINE1_MISSING'
          : !country || !present(country.name) ? 'COUNTRY_INVALID'
          : present(address.province_id) && (!province || !present(province.name)) ? 'PROVINCE_INVALID'
          : province && id(province.country_id) !== id(country.id) ? 'PROVINCE_COUNTRY_MISMATCH'
          : present(address.district_id) && (!district || !present(district.name)) ? 'DISTRICT_INVALID'
          : district && id(district.province_id) !== id(province?.id) ? 'DISTRICT_PROVINCE_MISMATCH' : 'WARD_INVALID_OR_PARENT_MISMATCH'
        diagnostics.addressDispositions.push({ ...disposition, disposition: 'invalid-source-address', reason }); continue
      }
      const city = id(address.city).trim() || id(district?.name).trim()
      const line2 = [...new Set([ward?.name, district?.name].map(v => id(v).trim()).filter(v => v && v !== city))].join(', ')
      const target = { label, line1: address.address.trim(), ...(line2 ? { line2 } : {}), ...(city ? { city } : {}), ...(province?.name ? { state: province.name } : {}), ...(present(address.post_code) ? { postcode: address.post_code } : {}), country: country.name, isDefault: false }
      const key = JSON.stringify([target.line1, target.line2 ?? '', target.city ?? '', target.state ?? '', target.postcode ?? '', target.country])
      if (locations.has(key)) {
        const prior = locations.get(key)
        if (label === 'Shipping') prior.shipping = true
        diagnostics.addressDispositions.push({ ...disposition, disposition: prior.index < 10 ? 'deduplicated' : 'overflow', targetIndex: prior.index < 10 ? prior.index : null }); continue
      }
      const entry = { target, index: selected.length, shipping: label === 'Shipping' }
      locations.set(key, entry); selected.push(entry)
      diagnostics.addressDispositions.push({ ...disposition, disposition: entry.index < 10 ? 'emitted' : 'overflow', targetIndex: entry.index < 10 ? entry.index : null })
    }
    customer.addresses = selected.slice(0, 10).map(e => e.target)
    const defaultIndex = selected.slice(0, 10).findIndex(e => e.shipping)
    if (customer.addresses.length) customer.addresses[defaultIndex < 0 ? 0 : defaultIndex].isDefault = true
    for (const member of group) { crosswalk.set(id(member.row.id), ref); diagnostics.customerCrosswalk.push({ sourceCustomerId: id(member.row.id), targetRef: ref, disposition: member === canonical ? 'canonical' : 'merged' }) }
    resultCustomers.push(customer)
  }
  output.customers = resultCustomers.sort((a, b) => compareId(sourceId(a._ref), sourceId(b._ref)))
  for (const order of output.orders ?? []) {
    const source = maps.orders.get(sourceId(order._ref))
    if (!owned(source) || !live(source) || order._ref !== `@orders:orders:${source.id}` || order.tenant !== `@tenants:stores:${storeId}`) throw new Error('Order ownership/reference mismatch')
    if (!present(source.customer_id)) { order.customer = null; continue }
    const targetRef = crosswalk.get(id(source.customer_id))
    if (!targetRef) throw new Error('Unresolved Order Customer reference')
    order.customer = targetRef
  }
  return { store: output, diagnostics, archive }
}
