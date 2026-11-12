/** Draft of the Providers page: on/off, base URL and options per provider, plus the gateway. */
import { providerName } from './status'
import type { GatewayView, SettingsView } from './types'

export interface ProvidersDraft {
  enabled: Record<string, boolean>
  /** '' = the provider's default URL */
  baseUrl: Record<string, string>
  options: Record<string, { reasoning: boolean; structuredOutputs: boolean }>
  gateway: { baseUrl: string; paths: Record<string, string> }
}

export function providersDraftFromView(view: SettingsView): ProvidersDraft {
  return {
    enabled: Object.fromEntries(view.providers.map((p) => [p.id, p.enabled])),
    baseUrl: Object.fromEntries(view.providers.map((p) => [p.id, p.baseUrlSource === 'studio' ? p.baseUrl ?? '' : ''])),
    options: Object.fromEntries(view.providers.map((p) => [p.id, { reasoning: p.options.reasoning ?? false, structuredOutputs: p.options.structuredOutputs ?? false }])),
    gateway: { baseUrl: view.gateway.baseUrl ?? '', paths: { ...view.gateway.paths } },
  }
}

const isUrl = (text: string): boolean => {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** id (or "gateway") → sentence for an invalid URL. */
export function providersProblems(draft: ProvidersDraft): Record<string, string> {
  const out: Record<string, string> = {}
  const bad = 'Enter a full address starting with https:// (or leave empty for the default).'
  for (const [id, url] of Object.entries(draft.baseUrl)) if (url.trim() && !isUrl(url.trim())) out[id] = bad
  if (draft.gateway.baseUrl.trim() && !isUrl(draft.gateway.baseUrl.trim())) out.gateway = bad
  return out
}

const shown = (url: string): string => url.trim() || 'default'

export function providersChanges(view: SettingsView, draft: ProvidersDraft): string[] {
  const before = providersDraftFromView(view)
  const lines: string[] = []
  for (const p of view.providers) {
    const name = providerName(view, p.id)
    if (before.enabled[p.id] !== draft.enabled[p.id]) lines.push(`${name}: turned ${draft.enabled[p.id] ? 'on' : 'off'}`)
    if (before.baseUrl[p.id] !== draft.baseUrl[p.id]) lines.push(`${name} base URL: ${shown(before.baseUrl[p.id])} → ${shown(draft.baseUrl[p.id])}`)
    const a = before.options[p.id]
    const b = draft.options[p.id]
    if (p.kind === 'compat' && a && b && a.reasoning !== b.reasoning) lines.push(`${name} reasoning effort: ${a.reasoning ? 'on' : 'off'} → ${b.reasoning ? 'on' : 'off'}`)
    if (p.kind === 'compat' && a && b && a.structuredOutputs !== b.structuredOutputs) lines.push(`${name} structured outputs: ${a.structuredOutputs ? 'on' : 'off'} → ${b.structuredOutputs ? 'on' : 'off'}`)
  }
  if (before.gateway.baseUrl !== draft.gateway.baseUrl) lines.push(`Gateway base URL: ${before.gateway.baseUrl.trim() || 'off'} → ${draft.gateway.baseUrl.trim() || 'off'}`)
  for (const [id, path] of Object.entries(draft.gateway.paths)) if (before.gateway.paths[id] !== path) lines.push(`Gateway path for ${id}: ${before.gateway.paths[id] ?? 'none'} → ${path || 'none'}`)
  return lines
}

export interface ProviderWrite { id: string; body: Record<string, unknown> }

/** One PUT per provider that changed; the gateway goes separately. */
export function providerWrites(view: SettingsView, draft: ProvidersDraft): ProviderWrite[] {
  const before = providersDraftFromView(view)
  const out: ProviderWrite[] = []
  for (const p of view.providers) {
    const body: Record<string, unknown> = {}
    if (before.enabled[p.id] !== draft.enabled[p.id]) body.enabled = draft.enabled[p.id]
    if (before.baseUrl[p.id] !== draft.baseUrl[p.id]) body.baseUrl = draft.baseUrl[p.id].trim() || null
    if (p.kind === 'compat' && JSON.stringify(before.options[p.id]) !== JSON.stringify(draft.options[p.id])) body.options = draft.options[p.id]
    if (Object.keys(body).length) out.push({ id: p.id, body })
  }
  return out
}

export function gatewayWrite(view: SettingsView, draft: ProvidersDraft): { baseUrl: string | null; paths: GatewayView['paths'] } | null {
  const before = providersDraftFromView(view).gateway
  if (before.baseUrl === draft.gateway.baseUrl && JSON.stringify(before.paths) === JSON.stringify(draft.gateway.paths)) return null
  return { baseUrl: draft.gateway.baseUrl.trim() || null, paths: draft.gateway.paths }
}

/** Only what the admin edited; the rest follows the view, so a key or endpoint write never loses an unsaved edit. */
export interface ProvidersPatch {
  enabled: Record<string, boolean>
  baseUrl: Record<string, string>
  options: Record<string, { reasoning: boolean; structuredOutputs: boolean }>
  gateway: { baseUrl?: string; paths: Record<string, string> }
}

export const emptyProvidersPatch = (): ProvidersPatch => ({ enabled: {}, baseUrl: {}, options: {}, gateway: { paths: {} } })

export const isPatchEmpty = (patch: ProvidersPatch): boolean => JSON.stringify(patch) === JSON.stringify(emptyProvidersPatch())

export function applyProvidersPatch(base: ProvidersDraft, patch: ProvidersPatch): ProvidersDraft {
  return {
    enabled: { ...base.enabled, ...patch.enabled },
    baseUrl: { ...base.baseUrl, ...patch.baseUrl },
    options: { ...base.options, ...patch.options },
    gateway: { baseUrl: patch.gateway.baseUrl ?? base.gateway.baseUrl, paths: { ...base.gateway.paths, ...patch.gateway.paths } },
  }
}
