'use client'

import { useEffect, useState } from 'react'

/**
 * EP shipping info for the order-detail fulfillment UI: real courier logos
 * (courier_logo from GET /courier/list) + wallet balance — both come back from ONE
 * call to /api/tenant/[id]/easyparcel-couriers, cached per tenant at module level.
 *
 * Wallet balance changes when a label is bought, so entries carry a short TTL and
 * label creation calls invalidateEpShippingInfo() to force a fresh read next mount.
 * Failures resolve to an empty result so consumers silently fall back (monogram
 * tile / no balance line).
 */

export interface EpWalletInfo { balance: string; currency: string }
interface EpShippingInfo { logos: Map<string, string>; wallet: EpWalletInfo | null; at: number }

const TTL_MS = 60_000
const cacheByTenant = new Map<string, EpShippingInfo>()
const inflightByTenant = new Map<string, Promise<EpShippingInfo>>()

/** Drop the cached entry (e.g. after buying a label — the wallet balance changed). */
export function invalidateEpShippingInfo(tenantId: string | number | null | undefined): void {
    if (tenantId != null) cacheByTenant.delete(String(tenantId))
}

function freshEntry(tenantId: string): EpShippingInfo | null {
    const hit = cacheByTenant.get(tenantId)
    return hit && Date.now() - hit.at < TTL_MS ? hit : null
}

async function fetchInfo(tenantId: string): Promise<EpShippingInfo> {
    const cached = freshEntry(tenantId)
    if (cached) return cached
    let inflight = inflightByTenant.get(tenantId)
    if (!inflight) {
        inflight = fetch(`/api/tenant/${tenantId}/easyparcel-couriers`)
            .then(async (res) => {
                const logos = new Map<string, string>()
                let wallet: EpWalletInfo | null = null
                if (res.ok) {
                    const j = await res.json().catch(() => null)
                    for (const c of j?.data?.couriers ?? []) {
                        if (c?.id && typeof c.logo === 'string' && c.logo) logos.set(String(c.id), c.logo)
                    }
                    const w = j?.data?.wallet
                    if (w?.balance != null) wallet = { balance: String(w.balance), currency: w.currency ?? 'MYR' }
                }
                const entry: EpShippingInfo = { logos, wallet, at: Date.now() }
                cacheByTenant.set(tenantId, entry)
                return entry
            })
            .catch(() => {
                const entry: EpShippingInfo = { logos: new Map(), wallet: null, at: Date.now() }
                cacheByTenant.set(tenantId, entry)
                return entry
            })
            .finally(() => inflightByTenant.delete(tenantId))
        inflightByTenant.set(tenantId, inflight)
    }
    return inflight
}

function useEpShippingInfo(tenantId: string | number | null | undefined): EpShippingInfo | null {
    const key = tenantId != null ? String(tenantId) : null
    const [info, setInfo] = useState<EpShippingInfo | null>(key ? freshEntry(key) : null)

    useEffect(() => {
        if (!key || freshEntry(key)) return
        let cancelled = false
        fetchInfo(key).then((entry) => { if (!cancelled) setInfo(entry) })
        return () => { cancelled = true }
    }, [key])

    return key ? freshEntry(key) ?? info : null
}

/** courier_id → logo URL map (null while loading / no tenant). */
export function useCourierLogos(tenantId: string | number | null | undefined): Map<string, string> | null {
    return useEpShippingInfo(tenantId)?.logos ?? null
}

/** EP wallet balance (null while loading / unavailable). */
export function useEpWallet(tenantId: string | number | null | undefined): EpWalletInfo | null {
    return useEpShippingInfo(tenantId)?.wallet ?? null
}
