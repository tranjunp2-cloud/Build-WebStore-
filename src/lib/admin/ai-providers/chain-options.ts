/** Choices for one chain slot: models of usable providers, each flagged when it has no price or its provider cannot answer. */
import { providerName, skipText, splitRef } from './status'
import type { SettingsView, SkipReason, TierId } from './types'

export interface ChainOption {
  ref: string
  model: string
  /** short phrases shown under the model name */
  notes: string[]
  /** already in this chain at another position */
  taken: boolean
}
export interface ChainGroup {
  id: string
  label: string
  options: ChainOption[]
}

/** The platform does not say which known models draw pictures; the names do. */
export const isImageModel = (model: string): boolean => /image|imagen|dall-?e|flux|sdxl|stable-diffusion/i.test(model)

function reasonOf(view: SettingsView, id: string): SkipReason | null {
  const p = view.providers.find((item) => item.id === id)
  if (!p) return 'unknown-provider'
  if (!p.enabled) return 'disabled'
  if (p.key.state === 'none' && p.kind === 'builtin') return 'no-key'
  if (p.key.state === 'needs-reentry') return 'needs-reentry'
  if (p.lastTest && !p.lastTest.ok) return 'last-test-failed'
  return null
}

/** `priced` null = prices unknown, nothing is flagged. */
export function chainOptions(view: SettingsView, tier: TierId, chain: string[], index: number, priced: ReadonlySet<string> | null): ChainGroup[] {
  const current = chain[index] ?? ''
  const groups: ChainGroup[] = []
  const seen = new Set<string>()
  const push = (id: string, model: string) => {
    const ref = `${id}:${model}`
    if (seen.has(ref)) return
    seen.add(ref)
    let group = groups.find((item) => item.id === id)
    if (!group) groups.push((group = { id, label: providerName(view, id), options: [] }))
    const reason = reasonOf(view, id)
    const notes = [
      reason ? skipText(reason, view.providers.find((p) => p.id === id)) : null,
      priced && !priced.has(ref) ? 'no price: usage counts $0' : null,
    ].filter((note): note is string => note !== null)
    group.options.push({ ref, model, notes, taken: chain.includes(ref) && ref !== current })
  }
  for (const p of view.providers) {
    // an OpenAI-compatible endpoint may need no key at all; a builtin provider without one cannot answer
    if (p.id === 'typesafe' || reasonOf(view, p.id) === 'disabled' || (p.kind === 'builtin' && p.key.state === 'none')) continue
    for (const model of p.models) if (isImageModel(model) === (tier === 'image')) push(p.id, model)
  }
  if (current) push(splitRef(current)[0], splitRef(current)[1])
  return groups
}
