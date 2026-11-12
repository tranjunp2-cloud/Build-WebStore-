/**
 * What each Studio team seat may change. Pure — safe in edge middleware and client components.
 *
 * Reads stay open to every seat (see `canViewStudio`); this table is only about writes and bulk exports.
 * Super-admin holds every permission. A user may hold several seats and gets the union.
 */
import {
    isSuperAdmin,
    STUDIO_CONTENT_ROLE,
    STUDIO_OPS_ROLE,
    STUDIO_QA_ROLE,
    STUDIO_REVIEWER_ROLE,
} from './studio-roles'

export const STUDIO_PERMISSIONS = [
    'template.create',
    'template.edit',
    'template.review',
    'template.score',
    'block.edit',
    'pack.edit',
    'pack.delete',
    'category.edit',
    'generation.issue',
    'generation.verify',
    'generation.retry',
    'issue.work',
    'issue.close',
    'issue.bulk',
    'qa.run',
    'qa.triage',
    'qa.promote',
    'qa.visual',
    'migration.review',
    'migration.scan',
    'migration.ingest',
    'data.export',
] as const

export type StudioPermission = (typeof STUDIO_PERMISSIONS)[number]

const SEAT_PERMISSIONS: Record<string, readonly StudioPermission[]> = {
    [STUDIO_CONTENT_ROLE]: [
        'template.create', 'template.edit', 'template.score', 'block.edit', 'pack.edit', 'category.edit',
        'generation.issue', 'issue.work', 'qa.visual',
    ],
    [STUDIO_REVIEWER_ROLE]: [
        'template.review', 'template.score', 'pack.delete', 'generation.issue',
        'issue.work', 'issue.close', 'issue.bulk', 'data.export',
    ],
    [STUDIO_QA_ROLE]: [
        'template.score', 'generation.issue', 'generation.verify', 'issue.work', 'issue.close', 'issue.bulk',
        'qa.run', 'qa.triage', 'qa.promote', 'qa.visual', 'migration.review', 'migration.scan', 'data.export',
    ],
    [STUDIO_OPS_ROLE]: [
        'generation.issue', 'generation.retry', 'issue.work', 'qa.run', 'qa.promote',
        'migration.scan', 'migration.ingest', 'data.export',
    ],
}

type Roles = readonly string[] | null | undefined

export function listStudioPermissions(roles: Roles): StudioPermission[] {
    if (isSuperAdmin(roles)) return [...STUDIO_PERMISSIONS]
    return [...new Set((roles ?? []).flatMap((role) => SEAT_PERMISSIONS[role] ?? []))]
}

export function hasStudioPermission(roles: Roles, permission: StudioPermission): boolean {
    return listStudioPermissions(roles).includes(permission)
}

/** Only drafts and templates waiting for review can be edited without pulling them back first. */
const EDITABLE_TEMPLATE_STATUSES = ['draft', 'review']

/** May this user change a template's content while it has this status? */
export function canEditTemplateContent(roles: Roles, status: unknown): boolean {
    if (isSuperAdmin(roles)) return true
    return hasStudioPermission(roles, 'template.edit') && EDITABLE_TEMPLATE_STATUSES.includes(String(status))
}

/**
 * May this user move a template between these statuses? Going live, scheduling and pulling a live
 * template back belong to the reviewer, so the person who edits a template cannot publish it.
 */
export function canSetTemplateStatus(roles: Roles, from: unknown, to: unknown): boolean {
    if (hasStudioPermission(roles, 'template.review')) return true
    if (!hasStudioPermission(roles, 'template.edit')) return false
    if (EDITABLE_TEMPLATE_STATUSES.includes(String(from))) return ['draft', 'review', 'archived'].includes(String(to))
    return from === 'archived' && to === 'draft'
}

/** Publish timing fields follow the status rules; every other field is template content. */
const STATUS_FIELDS = new Set(['status', 'scheduledFor'])

/** May this user apply this PATCH body to a template with this status? */
export function canPatchTemplate(roles: Roles, currentStatus: unknown, patch: Record<string, unknown>): boolean {
    const keys = Object.keys(patch).filter((key) => patch[key] !== undefined)
    const changesContent = keys.some((key) => !STATUS_FIELDS.has(key))
    if (changesContent && !canEditTemplateContent(roles, currentStatus)) return false
    const canReview = hasStudioPermission(roles, 'template.review')
    if (patch.scheduledFor !== undefined && !canReview) return false
    if (patch.status !== undefined && patch.status !== currentStatus) {
        return canSetTemplateStatus(roles, currentStatus, patch.status)
    }
    return canReview || hasStudioPermission(roles, 'template.edit')
}

const CLOSED_ISSUE_STATUSES = ['done', 'reopen']

/** Closing or reopening an issue (or moving one out of done) is a QA / reviewer call, never the fixer's. */
export function canSetIssueStatus(roles: Roles, from: unknown, to: unknown): boolean {
    if (from === to) return hasStudioPermission(roles, 'issue.work')
    if (CLOSED_ISSUE_STATUSES.includes(String(to)) || from === 'done') return hasStudioPermission(roles, 'issue.close')
    return hasStudioPermission(roles, 'issue.work')
}
