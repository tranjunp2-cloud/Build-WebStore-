'use client'

import { ArrowRight, ExternalLink, Loader2, Rocket } from 'lucide-react'
import { useI18n } from '@/i18n'

interface BuilderCompletionActionsProps {
    onOpenEditor: () => void
    onPublish: () => void
    onDashboard: () => void
    isPublishing?: boolean
    isNavigating?: boolean
}

/** Full-width action dock of the done state: Open editor (primary), Publish (outline), dashboard link. */
export function BuilderCompletionActions({ onOpenEditor, onPublish, onDashboard, isPublishing = false, isNavigating = false }: BuilderCompletionActionsProps) {
    const { t } = useI18n()
    const c = t.onboarding.completion
    return (
        <div className="bld-in grid gap-2.5" style={{ animationDelay: '.15s', animationDuration: '.45s' }}>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                <button
                    className="flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(45,212,191,.6),inset_0_1px_0_rgba(255,255,255,.22)] transition-[filter,transform] duration-150 [background-image:linear-gradient(90deg,#3b82f6,#2dd4bf)] hover:brightness-[1.08] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isPublishing || isNavigating}
                    onClick={onOpenEditor}
                    type="button"
                >
                    <ExternalLink aria-hidden className="size-4" />
                    {c.openEditor}
                </button>
                <button
                    className="box-border flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-solid border-[rgba(148,163,184,.24)] bg-[rgba(148,163,184,.06)] px-4 text-sm font-semibold text-[#e2e8f0] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-[10px] transition-[border-color,background-color,color,transform] duration-200 hover:border-[rgba(56,189,248,.55)] hover:bg-[rgba(56,189,248,.08)] hover:text-white active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isPublishing}
                    onClick={onPublish}
                    type="button"
                >
                    {isPublishing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Rocket aria-hidden className="size-4" />}
                    {isPublishing ? c.publishing : c.publishWebsite}
                </button>
            </div>
            <button
                className="flex h-8 items-center gap-1.5 justify-self-center rounded-lg px-2.5 text-[13px] font-medium text-[#94a3b8] transition-colors duration-200 hover:bg-white/[.04] hover:text-[#e2e8f0] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPublishing || isNavigating}
                onClick={onDashboard}
                type="button"
            >
                {isNavigating ? c.loading : c.goToDashboard}
                <ArrowRight aria-hidden className="size-3.5" />
            </button>
        </div>
    )
}
