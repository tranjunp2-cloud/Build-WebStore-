/**
 * Plan groups for the Studio "AI limits & prices" page, plus limit value (de)serialisation.
 * Pure + client-safe: no server imports (types only).
 */
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { AI_BUDGET_FEATURE, AI_PICTURES_FEATURE, aiLimitProblem } from '@/lib/ai-platform/ai-config-schema'

export type LimitKind = 'budget' | 'pictures'
export type LimitFeature = typeof AI_BUDGET_FEATURE | typeof AI_PICTURES_FEATURE

export const FEATURE_OF_KIND: Record<LimitKind, LimitFeature> = {
  budget: AI_BUDGET_FEATURE,
  pictures: AI_PICTURES_FEATURE,
}

export const UNLIMITED = 'UNLIMITED'

export interface PlanGroup {
  id: 'free' | 'starter' | 'standard' | 'professional'
  label: string
  codes: readonly PlanCode[]
}

/** One row per plan family on the page; a group edit writes every code of the group. */
export const PLAN_GROUPS: readonly PlanGroup[] = [
  { id: 'free', label: 'Free', codes: ['FREEMIUM'] },
  { id: 'starter', label: 'Starter', codes: ['STARTER_TM_USER', 'STARTER_NON_TM_USER'] },
  { id: 'standard', label: 'Standard', codes: ['STANDARD_TM_USER', 'STANDARD_NON_TM_USER'] },
  { id: 'professional', label: 'Professional', codes: ['PROFESSIONAL_TM_USER', 'PROFESSIONAL_NON_TM_USER'] },
]

export const ALL_PLAN_CODES: readonly PlanCode[] = PLAN_GROUPS.flatMap((group) => group.codes)

export function groupOfPlan(plan: string | null | undefined): PlanGroup | null {
  return PLAN_GROUPS.find((group) => (group.codes as readonly string[]).includes(plan ?? '')) ?? null
}

/** Stored limit string for the editor state: "Unlimited" switch off → the typed number. */
export function serializeLimit(draft: { unlimited: boolean; value: string }): string {
  return draft.unlimited ? UNLIMITED : draft.value.trim()
}

/** Stored limit string → editor state. YES reads as unlimited, as plan-limits does. */
export function parseLimitDraft(stored: string | null | undefined): { unlimited: boolean; value: string } {
  const text = (stored ?? '').trim()
  const upper = text.toUpperCase()
  if (upper === UNLIMITED || upper === 'YES') return { unlimited: true, value: '' }
  return { unlimited: false, value: text }
}

/** Normalised value to store (UNLIMITED upper-case, YES folded to UNLIMITED, numbers trimmed), or an error sentence. */
export function normalizeLimit(kind: LimitKind, raw: unknown): { value: string } | { error: string } {
  const problem = aiLimitProblem(FEATURE_OF_KIND[kind], raw)
  if (problem) return { error: problem }
  const text = String(raw).trim()
  const upper = text.toUpperCase()
  return { value: upper === UNLIMITED || upper === 'YES' ? UNLIMITED : text }
}

/** Value shown for a group: the shared value, or null when its codes differ. */
export function sharedValue(group: PlanGroup, values: Partial<Record<PlanCode, string>>): string | null {
  const first = values[group.codes[0]] ?? ''
  return group.codes.every((code) => (values[code] ?? '') === first) ? first : null
}
