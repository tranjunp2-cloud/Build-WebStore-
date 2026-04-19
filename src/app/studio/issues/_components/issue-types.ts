/**
 * Shared TypeScript types for the Issues feature.
 * Keep in sync with TemplateIssues collection schema.
 */

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssueStatus = 'open' | 'in-review' | 'fixed' | 'wont-fix'
export type IssueCategory = 'accessibility' | 'performance' | 'content' | 'ui' | 'ai-quality' | 'other'
export type IssueRelatedType = 'template' | 'generation' | 'block'

export interface IssueComment {
    id: string
    authorId: { id: number; email?: string } | number | null
    body: string
    createdAt: string
}

export interface IssueTimelineEntry {
    id: string
    event: string
    actorId: { id: number; email?: string } | number | null
    data: Record<string, unknown> | null
    at: string
}

export interface IssueRecord {
    id: number
    title: string
    description?: string
    severity: IssueSeverity
    category: IssueCategory
    status: IssueStatus
    relatedType: IssueRelatedType
    relatedId: string
    reportedBy?: { id: number; email?: string } | number | null
    assignedTo?: { id: number; email?: string } | number | null
    comments?: IssueComment[]
    timeline?: IssueTimelineEntry[]
    resolvedAt?: string
    createdAt: string
    updatedAt: string
}
