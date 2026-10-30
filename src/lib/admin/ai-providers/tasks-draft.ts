/** Draft of the Tasks page: tier override per task (null = follow the code's default). */
import { TIER_META } from './status'
import type { SettingsView, TaskView } from './types'

export type TasksDraft = Record<string, string | null>

export const OVERRIDE_TIERS = ['fast', 'balanced', 'quality'] as const

export const tierName = (tier: string): string => TIER_META[tier as keyof typeof TIER_META]?.name ?? tier

/** Pictures have one tier only; the others can move between the three text tiers. */
export const canOverride = (task: TaskView): boolean => task.defaultTier !== 'image'

export function tasksDraftFromView(view: SettingsView): TasksDraft {
  return Object.fromEntries(view.tasks.map((task) => [task.id, task.override]))
}

const label = (task: TaskView, tier: string | null): string => (tier ? tierName(tier) : `${tierName(task.defaultTier)} (default)`)

export function tasksChanges(view: SettingsView, draft: TasksDraft): string[] {
  return view.tasks
    .filter((task) => (draft[task.id] ?? null) !== task.override)
    .map((task) => `${task.label}: ${label(task, task.override)} → ${label(task, draft[task.id] ?? null)}`)
}

export const tasksBody = (draft: TasksDraft): { overrides: TasksDraft } => ({ overrides: draft })

/** Tasks grouped in the order the platform lists them. */
export function groupTasks(tasks: TaskView[]): Array<{ group: string; tasks: TaskView[] }> {
  const groups: Array<{ group: string; tasks: TaskView[] }> = []
  for (const task of tasks) {
    const found = groups.find((item) => item.group === task.group)
    if (found) found.tasks.push(task)
    else groups.push({ group: task.group, tasks: [task] })
  }
  return groups
}
