'use client'

import React from 'react'
import { ArrowUpRight, Check, Copy, Eye, Loader2, RefreshCw, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { PublishState, SaveStatus } from './EditorToolbar'

/** `https://shop.example.com/` → `shop.example.com` (scheme + trailing slash dropped). */
export function formatLiveLabel(siteUrl: string, maxLength = 28): string {
    const bare = siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    return bare.length > maxLength ? `${bare.slice(0, maxLength - 1)}…` : bare
}

/** Draft/live wording for the save indicator (US-F05-10, D-8). Only touches the settled
 * "saved" states of a live site; saving / unsaved keep their own wording. */
export function resolvePublishAwareSaveLabel(opts: {
    saveStatus: SaveStatus
    publishState: PublishState
    labels: { savedDraftNotLive: string; savedLive: string }
    fallback: string
}): string {
    const settled = opts.saveStatus === 'saved' || opts.saveStatus === 'savedJustNow'
    if (!settled) return opts.fallback
    if (opts.publishState === 'live-dirty') return opts.labels.savedDraftNotLive
    if (opts.publishState === 'live') return opts.labels.savedLive
    return opts.fallback
}

interface ToolbarPublishControlsProps {
    variant: 'desktop' | 'compact'
    publishState: PublishState
    siteId: string
    currentPageId: string | null
    siteUrl?: string | null
    previewDisabled: boolean
    previewDisabledTitle: string
    isPublishing: boolean
    isSaving: boolean
    busy: boolean
    publishSuccess: boolean
    onPublish: () => void
    onRepublish?: () => void
    onCopyLink?: () => void
}

const PRIMARY_CLS =
    'border-0 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] font-semibold text-white hover:opacity-95'

/**
 * The publish area of the editor header — exactly one primary button per state and no
 * Unpublish anywhere (it lives in Settings → Domains). Shared by desktop and compact headers.
 *  draft/publishing → Preview + Publish
 *  live-dirty/updating → Preview + Update live + small ↗ (open live)
 *  live → no Preview, no primary; `● domain ↗` ghost link + Copy link
 */
export function ToolbarPublishControls({
    variant,
    publishState,
    siteId,
    currentPageId,
    siteUrl,
    previewDisabled,
    previewDisabledTitle,
    isPublishing,
    isSaving,
    busy,
    publishSuccess,
    onPublish,
    onRepublish,
    onCopyLink,
}: ToolbarPublishControlsProps) {
    const { t } = useI18n()
    const et = t.editor.toolbar
    const compact = variant === 'compact'
    const isLive = publishState === 'live' || publishState === 'live-dirty' || publishState === 'updating'
    const showPreview = publishState !== 'live'
    const previewHref = currentPageId ? `/preview/${siteId}?pageId=${currentPageId}` : `/preview/${siteId}`
    const sizeCls = compact ? 'h-8 min-[768px]:h-11' : 'h-8'

    return (
        <>
            {showPreview && (previewDisabled ? (
                <Button
                    variant="ghost"
                    size={compact ? 'icon' : 'sm'}
                    disabled
                    title={previewDisabledTitle}
                    className={cn(
                        'shrink-0 rounded-lg text-slate-500 cursor-not-allowed opacity-50',
                        compact ? 'w-8 min-[768px]:w-11 ' + sizeCls : 'border border-white/[0.08] px-2 text-[11px] font-medium min-[1366px]:px-3 ' + sizeCls,
                    )}
                >
                    <Eye className="h-3.5 w-3.5 shrink-0" />
                    {!compact && <span className="hidden min-[1366px]:inline">{et.preview}</span>}
                </Button>
            ) : (
                <Button
                    variant="ghost"
                    size={compact ? 'icon' : 'sm'}
                    asChild
                    className={cn(
                        'shrink-0 rounded-lg text-slate-300 hover:bg-white/[0.06] hover:text-white',
                        compact ? 'w-8 min-[768px]:w-11 ' + sizeCls : 'border border-white/[0.08] px-2 text-[11px] font-medium min-[1366px]:px-3 ' + sizeCls,
                    )}
                >
                    <a href={previewHref} target="_blank" rel="noopener noreferrer" title={et.preview} aria-label={et.preview}>
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        {!compact && <span className="hidden min-[1366px]:inline">{et.preview}</span>}
                    </a>
                </Button>
            ))}

            {isLive && publishState !== 'live' && siteUrl && (
                <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${et.openLive}: ${siteUrl}`}
                    aria-label={et.openLive}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                    <ArrowUpRight className="h-4 w-4" />
                </a>
            )}

            {isLive && publishState !== 'live' && (
                <Button
                    type="button"
                    size="sm"
                    onClick={onRepublish}
                    disabled={isPublishing || isSaving || busy}
                    className={cn(PRIMARY_CLS, 'rounded-lg px-3.5 text-[11px]', sizeCls, compact && 'min-[768px]:px-4')}
                >
                    {isPublishing ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />{!compact && ` ${et.updating}`}</>
                    ) : (
                        <><RefreshCw className="h-3.5 w-3.5" /> {et.updateLive}</>
                    )}
                </Button>
            )}

            {publishState === 'live' && (
                <>
                    {siteUrl && (
                        <a
                            href={siteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={siteUrl}
                            aria-label={`${et.openLive}: ${siteUrl}`}
                            className={cn(
                                'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white',
                                sizeCls,
                            )}
                        >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                            <span className={cn(compact ? 'max-w-[88px] min-[768px]:max-w-[180px]' : 'max-w-[220px]', 'truncate')}>
                                {formatLiveLabel(siteUrl)}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                        </a>
                    )}
                    {siteUrl && onCopyLink && (
                        <button
                            type="button"
                            onClick={onCopyLink}
                            title={et.copyLink}
                            aria-label={et.copyLink}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/[0.06] hover:text-white"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                    )}
                </>
            )}

            {!isLive && (
                <Button
                    type="button"
                    size="sm"
                    onClick={onPublish}
                    disabled={isPublishing || publishSuccess || busy}
                    className={cn(PRIMARY_CLS, 'rounded-lg px-4 text-[11px]', sizeCls, publishSuccess && 'from-emerald-500 to-emerald-400')}
                >
                    {isPublishing ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />{!compact && ` ${et.publishing}`}</>
                    ) : publishSuccess ? (
                        <><Check className="h-3.5 w-3.5" /> {compact ? et.live : et.published}</>
                    ) : (
                        <><Rocket className="h-3.5 w-3.5" /> {et.publish}</>
                    )}
                </Button>
            )}
        </>
    )
}
