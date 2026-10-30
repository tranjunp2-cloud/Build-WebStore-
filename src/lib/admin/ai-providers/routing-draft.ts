/** Draft of the Routing page: chain, effort, timeout and (image) format per tier. */
import { effortOf, splitRef, TIER_META } from './status'
import { TIER_IDS, type ImageTierView, type SettingsView, type TierId } from './types'

export interface TierDraft {
  /** an empty string is a row where the model is not chosen yet */
  chain: string[]
  effort: string
  timeoutSec: string
  format: string
}
export type RoutingDraft = Record<TierId, TierDraft>

export const MAX_TIMEOUT_SEC = 290

export function routingDraftFromView(view: SettingsView): RoutingDraft {
  const draft = {} as RoutingDraft
  for (const id of TIER_IDS) {
    const tier = view.routing.tiers[id]
    draft[id] = {
      chain: [...tier.chain],
      effort: id === 'image' ? 'default' : (tier as { effort: string | null }).effort ?? 'default',
      timeoutSec: String(Math.round(tier.timeoutMs / 1000)),
      format: id === 'image' ? (tier as ImageTierView).format ?? 'webp' : '',
    }
  }
  return draft
}

const chainText = (chain: string[]): string => chain.filter(Boolean).map((ref) => splitRef(ref)[1]).join(' → ') || 'empty'

export function routingChanges(view: SettingsView, draft: RoutingDraft): string[] {
  const before = routingDraftFromView(view)
  const lines: string[] = []
  for (const id of TIER_IDS) {
    const a = before[id]
    const b = draft[id]
    const name = TIER_META[id].name
    if (a.chain.join(',') !== b.chain.filter(Boolean).join(',')) lines.push(`${name} chain: ${chainText(a.chain)} → ${chainText(b.chain)}`)
    if (id !== 'image' && a.effort !== b.effort) lines.push(`${name} effort: ${effortOf(a.effort).label} → ${effortOf(b.effort).label}`)
    if (a.timeoutSec !== b.timeoutSec) lines.push(`${name} timeout: ${a.timeoutSec} s → ${b.timeoutSec} s`)
    if (id === 'image' && a.format !== b.format) lines.push(`${name} format: ${a.format} → ${b.format}`)
  }
  return lines
}

/** Per tier: the sentence to show in red, or null. */
export function routingProblems(draft: RoutingDraft): Partial<Record<TierId, string>> {
  const out: Partial<Record<TierId, string>> = {}
  for (const id of TIER_IDS) {
    const tier = draft[id]
    const refs = tier.chain.filter(Boolean)
    const sec = Number(tier.timeoutSec)
    if (refs.length === 0) out[id] = 'Add at least one model, or this tier stops working.'
    else if (new Set(refs).size !== refs.length) out[id] = 'A model appears twice in this chain.'
    else if (!/^\d+$/.test(tier.timeoutSec.trim()) || sec < 1 || sec > MAX_TIMEOUT_SEC) out[id] = `Timeout must be a whole number of seconds from 1 to ${MAX_TIMEOUT_SEC}.`
  }
  return out
}

/**
 * Only tiers that changed, and in them only the fields that changed: a value the admin did not touch stays on the
 * environment (it would otherwise be frozen into Studio by an unrelated save).
 */
export function routingBody(view: SettingsView, draft: RoutingDraft): { tiers: Record<string, Record<string, unknown>> } {
  const before = routingDraftFromView(view)
  const tiers: Record<string, Record<string, unknown>> = {}
  for (const id of TIER_IDS) {
    const a = before[id]
    const b = draft[id]
    const body: Record<string, unknown> = {}
    if (a.chain.join(',') !== b.chain.filter(Boolean).join(',')) body.chain = b.chain.filter(Boolean)
    if (a.timeoutSec !== b.timeoutSec) body.timeoutMs = Number(b.timeoutSec) * 1000
    if (id === 'image' && a.format !== b.format) body.format = b.format || null
    if (id !== 'image' && a.effort !== b.effort) body.effort = b.effort === 'default' ? null : b.effort
    if (Object.keys(body).length) tiers[id] = body
  }
  return { tiers }
}

/** Tier drafts the admin touched; untouched tiers follow the view. */
export type RoutingPatch = Partial<Record<TierId, TierDraft>>

export const applyRoutingPatch = (base: RoutingDraft, patch: RoutingPatch): RoutingDraft => ({ ...base, ...patch })
