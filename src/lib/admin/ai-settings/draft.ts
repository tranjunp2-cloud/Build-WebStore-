/**
 * Editor state of the AI settings page (everything as strings so half-typed numbers survive) and the
 * conversions to/from the saved shapes. Pure + client-safe.
 */
import { CHAIN_KEYS, joinChain, parseChain } from './config-validation'
import { ALL_PLAN_CODES, LIMIT_KINDS, PLAN_GROUPS, sharedValue, type LimitKind } from './plan-groups'
import type { AiSettingsData, FieldError, LimitChange, LimitValues } from './types'

export type ChainKey = (typeof CHAIN_KEYS)[number]

export interface PriceRow {
  key: string
  input: string
  output: string
  cachedInput: string
  cacheWrite: string
  longFrom: string
  longInput: string
  longOutput: string
  /** seen unpriced in the logs and not yet priced: dropped from the save while input and output are blank */
  fromUnpriced: boolean
  /** parts of the stored price the table does not edit; written back unchanged */
  keep: { offPeakFactor?: number; longCachedInput?: number; longCacheWrite?: number }
}
export interface PictureRow {
  key: string
  price: string
}
export interface Draft {
  limits: LimitValues
  chains: Record<ChainKey, string[]>
  prices: PriceRow[]
  pictures: PictureRow[]
}

const text = (value: number | undefined) => (value === undefined ? '' : String(value))
/** '' → omitted; a number → number; anything else stays text so the server names the field. */
const num = (value: string): number | string | undefined => {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  return Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed
}

export function blankPriceRow(key: string, fromUnpriced = false): PriceRow {
  return { key, input: '', output: '', cachedInput: '', cacheWrite: '', longFrom: '', longInput: '', longOutput: '', fromUnpriced, keep: {} }
}

export function draftFromData(data: AiSettingsData): Draft {
  const { config } = data
  const prices: PriceRow[] = Object.entries(config.prices).map(([key, price]) => ({
    key, input: text(price.input), output: text(price.output), cachedInput: text(price.cachedInput), cacheWrite: text(price.cacheWrite),
    longFrom: text(price.longContext?.aboveInputTokens), longInput: text(price.longContext?.input), longOutput: text(price.longContext?.output),
    fromUnpriced: false,
    keep: { offPeakFactor: price.offPeakFactor, longCachedInput: price.longContext?.cachedInput, longCacheWrite: price.longContext?.cacheWrite },
  }))
  for (const { model } of data.unpriced) if (!(model in config.prices)) prices.push(blankPriceRow(model, true))
  return {
    limits: structuredClone(data.limits),
    chains: Object.fromEntries(CHAIN_KEYS.map((key) => [key, parseChain(config.models[key])])) as Record<ChainKey, string[]>,
    prices,
    pictures: Object.entries(config.images).map(([key, price]) => ({ key, price: String(price) })),
  }
}

export function draftToConfig(draft: Draft): unknown {
  const prices: Record<string, unknown> = {}
  for (const row of draft.prices) {
    if (row.fromUnpriced && !row.input.trim() && !row.output.trim()) continue
    const long = row.longFrom.trim()
      ? { aboveInputTokens: num(row.longFrom), input: num(row.longInput), output: num(row.longOutput), cachedInput: row.keep.longCachedInput, cacheWrite: row.keep.longCacheWrite }
      : undefined
    prices[row.key.trim()] = { input: num(row.input), output: num(row.output), cachedInput: num(row.cachedInput), cacheWrite: num(row.cacheWrite), offPeakFactor: row.keep.offPeakFactor, longContext: long }
  }
  const models: Record<string, string> = {}
  for (const key of CHAIN_KEYS) if (draft.chains[key].length) models[key] = joinChain(draft.chains[key])
  return { prices, images: Object.fromEntries(draft.pictures.map((row) => [row.key.trim(), num(row.price)])), models }
}

/** Only the plan codes whose value differs from what is saved. */
export function limitChanges(saved: LimitValues, draft: LimitValues): LimitChange[] {
  const out: LimitChange[] = []
  for (const kind of LIMIT_KINDS) {
    for (const planCode of ALL_PLAN_CODES) {
      if (saved[kind]?.[planCode] !== draft[kind]?.[planCode]) out.push({ planCode, kind, value: draft[kind][planCode] })
    }
  }
  return out
}

const LIMIT_LABELS: Record<LimitKind, string> = { budget: 'AI budget', pictures: 'Pictures', monthly: 'Monthly AI budget', site: 'Website setup budget', enabled: 'AI' }

const shown = (kind: LimitKind, value: string | null) => {
  if (value === null) return 'differs by code'
  const upper = value.toUpperCase()
  if (kind === 'enabled') return upper === 'NO' ? 'Off' : 'On'
  if (upper === 'UNLIMITED' || upper === 'YES') return 'Unlimited'
  if (kind === 'monthly') return `$${value}/month`
  return kind === 'budget' || kind === 'site' ? `$${value}/day` : `${value}/day`
}

/** Human lines for plan limit changes. */
export function describeLimitChanges(data: AiSettingsData, draft: Draft): string[] {
  const lines: string[] = []
  for (const group of PLAN_GROUPS) {
    for (const kind of LIMIT_KINDS) {
      if (!group.codes.some((code) => data.limits[kind]?.[code] !== draft.limits[kind]?.[code])) continue
      const label = LIMIT_LABELS[kind]
      lines.push(`${group.label} · ${label}: ${shown(kind, sharedValue(group, data.limits[kind]))} → ${shown(kind, sharedValue(group, draft.limits[kind]))}`)
    }
  }
  return lines
}

/** Human lines for model chain and price changes. */
export function describeConfigChanges(data: AiSettingsData, draft: Draft): string[] {
  const lines: string[] = []
  const before = draftFromData({ ...data, unpriced: [] })
  for (const key of CHAIN_KEYS) {
    if (before.chains[key].join() !== draft.chains[key].join()) lines.push(`Model chain ${key}: ${before.chains[key].join(' → ') || 'none'} → ${draft.chains[key].join(' → ') || 'none'}`)
  }
  const oldPrices = new Map(before.prices.map((row) => [row.key, JSON.stringify({ ...row, fromUnpriced: false })]))
  for (const row of draft.prices) {
    if (row.fromUnpriced && !row.input.trim() && !row.output.trim()) continue
    const was = oldPrices.get(row.key)
    if (was === undefined) lines.push(`Price added: ${row.key}`)
    else if (was !== JSON.stringify({ ...row, fromUnpriced: false })) lines.push(`Price changed: ${row.key}`)
  }
  for (const key of oldPrices.keys()) if (!draft.prices.some((row) => row.key === key)) lines.push(`Price removed: ${key}`)
  const oldPictures = new Map(before.pictures.map((row) => [row.key, row.price]))
  for (const row of draft.pictures) if (oldPictures.get(row.key) !== row.price) lines.push(`Picture price ${oldPictures.has(row.key) ? 'changed' : 'added'}: ${row.key}`)
  for (const key of oldPictures.keys()) if (!draft.pictures.some((row) => row.key === key)) lines.push(`Picture price removed: ${key}`)
  return lines
}

/** Human lines for the unsaved-changes bar and the confirm dialog. */
export function describeChanges(data: AiSettingsData, draft: Draft): string[] {
  return [...describeLimitChanges(data, draft), ...describeConfigChanges(data, draft)]
}

export const errorKey = (path: readonly string[]) => path.join('|')
export function indexErrors(errors: readonly FieldError[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const error of errors) if (!map.has(errorKey(error.path))) map.set(errorKey(error.path), error.message)
  return map
}

/** Config part of the save only when something in it changed. */
export function configIfChanged(data: AiSettingsData, draft: Draft): unknown {
  return describeConfigChanges(data, draft).length ? draftToConfig(draft) : undefined
}
