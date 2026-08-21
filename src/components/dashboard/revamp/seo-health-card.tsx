'use client'

import {
    AlertTriangle,
    Check,
    CircleAlert,
    Pencil,
    RotateCcw,
    Send,
    Settings,
    Sparkles,
    Info,
    Wand2,
    type LucideIcon,
} from 'lucide-react'
import { useI18n, type Translations } from '@/i18n'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTapToggleTooltip } from '@/hooks/use-tap-toggle-tooltip'
import type {
    SeoHealthBucketKey,
    SeoHealthCardLoadState,
    SeoHealthIssueAction,
    SeoHealthIssueCode,
    SeoHealthIssueViewModel,
} from '@/lib/dashboard/dashboard-types'
import { Button } from '@/components/ui/button'
import { Gauge, gaugeStatusKey } from './charts'
import { SectionHead } from './atoms'

const BUCKET_ORDER: readonly SeoHealthBucketKey[] = [
    'business',
    'schema',
    'aiDiscoverability',
    'technical',
]
type SeoHealthIssueCopyKey =
    keyof Translations['dashboard']['revamp']['seo']['target']['issues']
type SeoHealthIssueGuidanceKey =
    keyof Translations['dashboard']['revamp']['seo']['target']['issueGuidance']

const ISSUE_COPY_KEY = {
    'store-name': 'storeName',
    'business-address': 'businessAddress',
    phone: 'phone',
    'schema-subtype': 'schemaSubtype',
    'opening-hours': 'openingHours',
    'map-location': 'mapLocation',
    'price-range': 'priceRange',
    'primary-domain': 'primaryDomain',
    'store-unpublished': 'storeUnpublished',
    'meta-title': 'metaTitle',
    'meta-description': 'metaDescription',
    'content-quality': 'contentQuality',
    'image-alt': 'imageAlt',
    'search-verification': 'searchVerification',
} satisfies Record<SeoHealthIssueCode, SeoHealthIssueCopyKey>

const ISSUE_GUIDANCE_KEY = ISSUE_COPY_KEY satisfies Record<SeoHealthIssueCode, SeoHealthIssueGuidanceKey>

type ActionCopy = { fix: string; edit: string; setUp: string; publish: string }

function IssueGuidanceTooltip({ issueLabel, guidance }: { issueLabel: string; guidance: string }) {
    const { open, onOpenChange, onPointerDown, onTouchStart, onFocus, onClick, ref } = useTapToggleTooltip<HTMLButtonElement>()

    return (
        <TooltipProvider>
            <Tooltip open={open} onOpenChange={onOpenChange}>
            <TooltipTrigger asChild>
                <button
                    ref={ref}
                    type="button"
                    className="seo-target-issue-help"
                    aria-label={issueLabel + ': ' + guidance}
                    onPointerDown={onPointerDown}
                    onTouchStart={onTouchStart}
                    onFocus={onFocus}
                    onClick={onClick}
                >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="seo-target-issue-guidance-popover">
                <p className="seo-target-issue-guidance-title">{issueLabel}</p>
                <p className="seo-target-issue-guidance-copy">{guidance}</p>
            </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function assertNever(value: never): never {
    throw new Error(`Unhandled SEO Health action: ${JSON.stringify(value)}`)
}

function actionPresentation(
    action: SeoHealthIssueAction,
    copy: ActionCopy,
): { actor: 'ai' | 'you'; label: string; Icon: LucideIcon } {
    switch (action.kind) {
        case 'fix-meta-title':
        case 'fix-meta-description':
            return { actor: 'ai', label: copy.fix, Icon: Wand2 }
        case 'setup-primary-domain':
        case 'setup-search-verification':
            return { actor: 'you', label: copy.setUp, Icon: Settings }
        case 'publish-store':
            return { actor: 'you', label: copy.publish, Icon: Send }
        case 'edit-store-name':
        case 'edit-business-address':
        case 'edit-phone':
        case 'edit-schema-subtype':
        case 'edit-opening-hours':
        case 'edit-map-location':
        case 'edit-price-range':
        case 'edit-content':
        case 'edit-image-alt':
            return { actor: 'you', label: copy.edit, Icon: Pencil }
        default:
            return assertNever(action)
    }
}

export interface SeoHealthCardProps {
    data: SeoHealthCardLoadState
    onIssueAction: (action: SeoHealthIssueAction) => void
    onFixAllMetadata: () => void
    onRetry: () => void
}

export function SeoHealthCard({
    data,
    onIssueAction,
    onFixAllMetadata,
    onRetry,
}: SeoHealthCardProps) {
    const { t, ti, tp } = useI18n()
    const seoT = t.dashboard.revamp.seo
    const targetT = seoT.target

    if (data.state === 'loading') {
        return (
            <section className="section">
                <SectionHead
                    icon="search-check"
                    title={seoT.title}
                    sub={seoT.subtitle}
                />
                <div
                    className="card seo-card seo-target-card seo-target-loading"
                    role="status"
                    aria-busy="true"
                >
                    <span className="seo-target-state-copy">
                        {targetT.loading}
                    </span>
                    <div className="seo-target-loading-grid" aria-hidden>
                        <span className="seo-target-skeleton seo-target-skeleton-gauge" />
                        <span className="seo-target-skeleton seo-target-skeleton-bars" />
                    </div>
                    <span
                        className="seo-target-skeleton seo-target-skeleton-strip"
                        aria-hidden
                    />
                    <span
                        className="seo-target-skeleton seo-target-skeleton-issues"
                        aria-hidden
                    />
                </div>
            </section>
        )
    }

    if (data.state === 'error') {
        return (
            <section className="section">
                <SectionHead
                    icon="search-check"
                    title={seoT.title}
                    sub={seoT.subtitle}
                />
                <div
                    className="card seo-card seo-target-card seo-target-error"
                    role="alert"
                >
                    <span className="seo-target-state-icon">
                        <CircleAlert aria-hidden />
                    </span>
                    <div className="seo-target-state-body">
                        <h3>{targetT.errorTitle}</h3>
                        <p>{targetT.errorDescription}</p>
                    </div>
                    <button
                        type="button"
                        className="seo-target-retry"
                        onClick={onRetry}
                    >
                        <RotateCcw aria-hidden />
                        {targetT.retry}
                    </button>
                </div>
            </section>
        )
    }

    const aiFixableItemCount = data.aiFixableItemCount
    const criticalIssue = data.issues.find(
        issue => issue.action.kind === 'fix-meta-title' || issue.action.kind === 'fix-meta-description',
    )
    const criticalIssueText = criticalIssue
        ? (criticalIssue.count === 1
              ? targetT.issues[ISSUE_COPY_KEY[criticalIssue.code]].one
              : targetT.issues[ISSUE_COPY_KEY[criticalIssue.code]].other
          ).replace('{count}', '').trim()
        : tp(targetT.aiCanFix, aiFixableItemCount)
    const criticalIssueCopy = criticalIssue
        ? ti(seoT.criticalIssue, {
              count: criticalIssue.count,
              text: criticalIssueText,
          })
        : criticalIssueText
    const allClear = data.score === 100 && data.issues.length === 0
    const hasNoSellerActions = !allClear && data.issues.length === 0

    return (
        <section className="section">
            <SectionHead
                icon="search-check"
                title={seoT.title}
                sub={seoT.subtitle}
            />
            <div
                className="card seo-card seo-target-card"
                data-testid="seo-health-ready"
            >
                <div className="seo-target-overview">
                    <Gauge
                        score={data.score}
                        animate={false}
                        label={seoT[gaugeStatusKey(data.score)]}
                    />
                    <div className="seo-target-buckets">
                        {BUCKET_ORDER.map((key) => {
                            const bucket = data.buckets[key]
                            const progress = Math.min(
                                100,
                                Math.max(0, bucket.progress),
                            )
                            return (
                                <div className="seo-target-bucket" key={key}>
                                    <div className="seo-target-bucket-head">
                                        <span>{targetT.buckets[key]}</span>
                                        <strong
                                            className={`seo-target-status ${bucket.status}`}
                                        >
                                            {targetT.status[bucket.status]}
                                        </strong>
                                    </div>
                                    <span
                                        className="seo-target-progress"
                                        role="progressbar"
                                        aria-label={`${targetT.buckets[key]}: ${targetT.status[bucket.status]}`}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={progress}
                                    >
                                        <span
                                            className={
                                                bucket.status === 'good'
                                                    ? 'fill-good'
                                                    : 'fill-warn'
                                            }
                                            style={{ width: `${progress}%` }}
                                        />
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {aiFixableItemCount > 0 && (
                    <div className="seo-footer">
                        <span className="warn-ic">
                            <AlertTriangle aria-hidden />
                        </span>
                        <span className="warn-txt">
                            {criticalIssueCopy}
                        </span>
                        <Button
                            variant="dashPrimary"
                            size="sm"
                            className="seo-target-ai-action shrink-0 whitespace-nowrap"
                            onClick={onFixAllMetadata}
                        >
                            <Sparkles aria-hidden />
                            {aiFixableItemCount > 100
                                ? targetT.fixNextBatch
                                : targetT.fixAll}
                        </Button>
                    </div>
                )}

                <div className="seo-target-issues">
                    <div className="seo-target-issues-head">
                        <h3>{seoT.issuesTitle}</h3>
                        <span
                            className={`seo-target-open-badge${allClear ? ' clear' : ''}`}
                        >
                            {allClear && <Check aria-hidden />}
                            {allClear
                                ? seoT.allClear
                                : ti(seoT.open, { count: data.issues.length })}
                        </span>
                    </div>
                    {allClear ? (
                        <div className="seo-target-clear" role="status">
                            <span className="seo-target-clear-icon">
                                <Check aria-hidden />
                            </span>
                            <div>
                                <h4>{seoT.allResolvedTitle}</h4>
                                <p>{seoT.allResolvedDesc}</p>
                            </div>
                        </div>
                    ) : hasNoSellerActions ? (
                        <div className="seo-target-managed" role="status">
                            <span className="seo-target-state-icon">
                                <Settings aria-hidden />
                            </span>
                            <div className="seo-target-state-body">
                                <h4>{seoT.noSellerActionTitle}</h4>
                                <p>{seoT.noSellerActionDesc}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="seo-target-issue-grid">
                            {data.issues.map((issue) => {
                                const presentation = actionPresentation(
                                    issue.action,
                                    targetT.actions,
                                )
                                const issueCopy =
                                    targetT.issues[ISSUE_COPY_KEY[issue.code]]
                                const issueLabel = tp(issueCopy, issue.count)
                                return (
                                    <div
                                        className="seo-target-issue-row"
                                        key={issue.id}
                                    >
                                        <span
                                            className={`seo-target-actor ${presentation.actor}`}
                                        >
                                            {targetT.actors[presentation.actor]}
                                        </span>
                                        <span className="seo-target-issue-copy">
                                            {issueLabel}
                                        </span>
                                        <IssueGuidanceTooltip
                                            issueLabel={issueLabel}
                                            guidance={targetT.issueGuidance[ISSUE_GUIDANCE_KEY[issue.code]]}
                                        />
                                        <button
                                            type="button"
                                            className="seo-target-issue-action"
                                            aria-label={presentation.label + ': ' + issueLabel}
                                            onClick={() =>
                                                onIssueAction(issue.action)
                                            }
                                        >
                                            <presentation.Icon aria-hidden />
                                            {presentation.label}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
