import 'server-only'
/**
 * Reads and writes the AI limits / prices through the Payload local API, so PlanFeatures' beforeChange
 * hook still validates every write. Callers must have checked super-admin: these use overrideAccess.
 */
import config from '@payload-config'
import { getPayload, ValidationError, type Payload } from 'payload'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { AI_PLATFORM_CONFIG_FEATURE, AiPlatformConfigSchema, type AiPlatformConfig } from '@/lib/ai-platform/ai-config-schema'
import { clearAiConfigCache } from '@/lib/ai-platform/ai-config'
import { DEFAULT_AI_LIMITS, clearAiLimitsCache } from '@/lib/ai-platform/plan-limits'
import { validateConfig } from './config-validation'
import { ALL_PLAN_CODES, FEATURE_OF_KIND, UNLIMITED, normalizeLimit, type LimitKind } from './plan-groups'
import { loadGroupStats, loadUnpricedModels } from './usage-queries'
import type { AiSettingsData, FieldError, LimitChange, LimitValues } from './types'

const KINDS: LimitKind[] = ['budget', 'pictures']
const LIMIT_FEATURES = KINDS.map((kind) => FEATURE_OF_KIND[kind])

export interface SaveInput {
  limits?: LimitChange[]
  config?: unknown
}
export type SaveResult = { ok: true; written: number } | { ok: false; errors: FieldError[] }

const asText = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback)

/** A missing row shows the same default ai-platform enforces for it. */
function defaultLimit(kind: LimitKind, code: PlanCode): string {
  const defaults = DEFAULT_AI_LIMITS[code]
  return String(kind === 'budget' ? defaults.aiBudgetUsd : defaults.picturesPerDay)
}

export async function loadAiSettings(): Promise<AiSettingsData> {
  const payload = await getPayload({ config })
  const [rows, configRows, stats, unpriced] = await Promise.all([
    payload.find({
      collection: 'plan-features', overrideAccess: true, depth: 0, pagination: false, limit: 100,
      where: { featureCode: { in: LIMIT_FEATURES } },
    }),
    payload.find({
      collection: 'plan-features', overrideAccess: true, depth: 0, pagination: false, limit: 1, sort: '-updatedAt',
      where: { featureCode: { equals: AI_PLATFORM_CONFIG_FEATURE } },
    }),
    loadGroupStats(),
    loadUnpricedModels(),
  ])
  const limits = { budget: {}, pictures: {} } as unknown as LimitValues
  for (const kind of KINDS) {
    for (const code of ALL_PLAN_CODES) {
      const row = rows.docs.find((doc) => doc.planCode === code && doc.featureCode === FEATURE_OF_KIND[kind])
      limits[kind][code] = asText(row?.value, defaultLimit(kind, code))
    }
  }
  const row = configRows.docs[0]
  const parsed = AiPlatformConfigSchema.safeParse(row?.settings ?? {})
  const emptyConfig: AiPlatformConfig = { prices: {}, images: {}, models: {} }
  return {
    limits,
    config: parsed.success ? parsed.data : emptyConfig,
    configUpdatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    configInvalid: !parsed.success,
    stats,
    unpriced,
  }
}

/** Collection-hook ValidationError → page field errors under `path`. */
function hookErrors(error: unknown, path: string[]): FieldError[] | null {
  if (!(error instanceof ValidationError)) return null
  const items = (error.data as { errors?: Array<{ message?: string }> } | undefined)?.errors ?? []
  return [{ path, message: items[0]?.message ?? error.message }]
}

async function writeLimit(payload: Payload, change: LimitChange, value: string): Promise<void> {
  const featureCode = FEATURE_OF_KIND[change.kind]
  const found = await payload.find({
    collection: 'plan-features', overrideAccess: true, depth: 0, limit: 1, pagination: false,
    where: { and: [{ planCode: { equals: change.planCode } }, { featureCode: { equals: featureCode } }] },
  })
  const existing = found.docs[0]
  if (existing) {
    await payload.update({ collection: 'plan-features', id: existing.id, data: { value }, overrideAccess: true })
  } else {
    await payload.create({ collection: 'plan-features', data: { planCode: change.planCode, featureCode, value }, overrideAccess: true })
  }
}

async function writeConfig(payload: Payload, settings: AiPlatformConfig): Promise<void> {
  const found = await payload.find({
    collection: 'plan-features', overrideAccess: true, depth: 0, limit: 1, pagination: false, sort: '-updatedAt',
    where: { featureCode: { equals: AI_PLATFORM_CONFIG_FEATURE } },
  })
  const existing = found.docs[0]
  if (existing) {
    await payload.update({ collection: 'plan-features', id: existing.id, data: { settings }, overrideAccess: true })
  } else {
    // the single platform row lives under FREEMIUM (see PlanFeatures description)
    await payload.create({
      collection: 'plan-features',
      data: { planCode: 'FREEMIUM', featureCode: AI_PLATFORM_CONFIG_FEATURE, value: UNLIMITED, settings },
      overrideAccess: true,
    })
  }
}

/** Validates everything first (nothing is written if anything is invalid), then writes and clears the ai-platform caches. */
export async function saveAiSettings(input: SaveInput): Promise<SaveResult> {
  const errors: FieldError[] = []
  const planned: Array<{ change: LimitChange; value: string }> = []
  for (const change of input.limits ?? []) {
    if (!ALL_PLAN_CODES.includes(change.planCode) || !KINDS.includes(change.kind)) {
      errors.push({ path: ['limits', String(change.planCode), String(change.kind)], message: 'Unknown plan or limit.' })
      continue
    }
    const normalized = normalizeLimit(change.kind, change.value)
    if ('error' in normalized) errors.push({ path: ['limits', change.planCode, change.kind], message: normalized.error })
    else planned.push({ change, value: normalized.value })
  }
  let settings: AiPlatformConfig | null = null
  if (input.config !== undefined) {
    const checked = validateConfig(input.config)
    if ('errors' in checked) errors.push(...checked.errors)
    else settings = checked.config
  }
  if (errors.length) return { ok: false, errors }

  const payload = await getPayload({ config })
  let written = 0
  try {
    for (const { change, value } of planned) {
      try {
        await writeLimit(payload, change, value)
        written += 1
      } catch (error) {
        const mapped = hookErrors(error, ['limits', change.planCode, change.kind])
        if (!mapped) throw error
        return { ok: false, errors: mapped }
      }
    }
    if (settings) {
      try {
        await writeConfig(payload, settings)
        written += 1
      } catch (error) {
        const mapped = hookErrors(error, ['config'])
        if (!mapped) throw error
        return { ok: false, errors: mapped }
      }
    }
  } finally {
    // also after a partial failure: whatever was written must reach ai-platform
    if (written > 0) {
      clearAiLimitsCache()
      clearAiConfigCache()
    }
  }
  return { ok: true, written }
}
