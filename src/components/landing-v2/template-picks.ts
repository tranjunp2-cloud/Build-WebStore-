import type { LvTemplate } from './lv-types'

/** "All" chip shows the first template of each of these categories, in this order. */
export const ALL_PICK_CATEGORIES = ['restaurant', 'ecommerce', 'beauty', 'tech', 'fnb', 'health', 'realestate', 'fitness'] as const
/** Bento card "56 templates" previews one template of each. */
export const BENTO_PREVIEW_CATEGORIES = ['tech', 'beauty', 'realestate'] as const

const FALLBACK_ALL_COUNT = ALL_PICK_CATEGORIES.length

function asCategories(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === 'string')
  return typeof raw === 'string' ? [raw] : []
}

/** Validate the /api/templates/list payload at the boundary; drops malformed docs, sorts by id for a stable "first". */
export function parseTemplates(json: unknown): LvTemplate[] {
  const docs = (json as { docs?: unknown } | null)?.docs
  if (!Array.isArray(docs)) return []
  const out: LvTemplate[] = []
  for (const d of docs as Array<Record<string, unknown>>) {
    const id = typeof d?.id === 'number' || typeof d?.id === 'string' ? String(d.id) : ''
    if (!id || typeof d.name !== 'string' || !d.name) continue
    out.push({ id, name: d.name, category: asCategories(d.category) })
  }
  return out.sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id))
}

export function firstOfCategory(templates: LvTemplate[], cat: string): LvTemplate | undefined {
  return templates.find((t) => t.category.includes(cat))
}

/** Templates shown in the carousel for the active chip. */
export function templatesForChip(templates: LvTemplate[], chip: string): LvTemplate[] {
  if (chip !== 'all') return templates.filter((t) => t.category.includes(chip))
  const picks = ALL_PICK_CATEGORIES
    .map((c) => firstOfCategory(templates, c))
    .filter((t): t is LvTemplate => Boolean(t))
  return picks.length ? picks : templates.slice(0, FALLBACK_ALL_COUNT)
}
