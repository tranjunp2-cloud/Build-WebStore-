/**
 * Shared TypeScript types for the Issues feature.
 * Keep in sync with TemplateIssues collection schema.
 */

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssueStatus = 'backlog' | 'reopen' | 'in_progress' | 'dev_fixed' | 'testing' | 'done'
export type IssueCategory = 'accessibility' | 'performance' | 'content' | 'ui' | 'ai-quality' | 'other'
export type IssueRelatedType = 'template' | 'generation' | 'block' | 'runtime' | 'manual'
export type IssueAssignmentTarget = 'unassigned' | 'dev'
export type LiveErrorSource = 'sentry' | 'vercel'

export interface LiveErrorTenantMatch {
    id: string
    slug: string
    name: string
}

export interface LiveErrorGuidance {
    category:
        | 'http-500-503'
        | 'timeout'
        | 'authentication'
        | 'not-found'
        | 'rate-limit'
        | 'application-exception'
        | 'unmatched'
    investigationArea: string
    checks: [string, string]
    escalationCondition: string
    label: 'Suggested next checks'
}

export interface LiveErrorFrame {
    function: string | null
    module: string | null
    filename: string | null
    line: number | null
}

export interface LiveError {
    source: LiveErrorSource
    providerId: string
    occurredAt: string
    severity: IssueSeverity
    message: string
    host: string | null
    tenantMatch: LiveErrorTenantMatch | null
    route: string | null
    method: string | null
    statusCode: number | null
    release: string | null
    deploymentId: string | null
    requestId: string | null
    traceId: string | null
    frames: LiveErrorFrame[]
    providerUrl: string | null
    guidance: LiveErrorGuidance
}

export interface RuntimePromotionInput {
    source: 'sentry'
    providerId: string
    title: string
    severity: IssueSeverity
}

export interface IssueComment {
    id: string
    author: { id: number; email?: string } | number | null
    body: string
    createdAt: string
}

export interface IssueTimelineEntry {
    id: string
    event: string
    actor: { id: number; email?: string } | number | null
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
    assignmentTarget?: IssueAssignmentTarget
    comments?: IssueComment[]
    timeline?: IssueTimelineEntry[]
    resolvedAt?: string
    createdAt: string
    updatedAt: string
}
