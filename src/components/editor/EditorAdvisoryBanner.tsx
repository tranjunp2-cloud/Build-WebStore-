'use client'

import { useEffect, useState } from 'react'
import { Link2, X } from 'lucide-react'
import { useI18n } from '@/i18n'

const DISMISS_KEY = 'hide_mobile_editor_warning'

export interface EditorAdvisoryBannerProps {
    /** Same handler `EditorToolbar`'s "Copy Link" uses (page.tsx) — reused verbatim,
     * including its own success toast. No forked clipboard implementation here. */
    onCopyLink: () => void
    /** Lets the host (`CompactEditorLayout`) offset the empty-page FAB above the
     * banner while it's showing, so the two never overlap. Fires once after the
     * mount effect resolves the real dismiss state, and again on dismiss. */
    onVisibleChange?: (visible: boolean) => void
}

/**
 * F05/#1472 Part B — dismissible "better on Desktop" advisory. Lives inside
 * `CompactEditorLayout`, which only mounts <1280, so this is structurally absent
 * on desktop — no separate breakpoint check needed here.
 *
 * Dismiss state is session-scoped (`sessionStorage`, not `localStorage`): stays
 * hidden for the rest of the browser tab session (survives F5, like `sessionStorage`
 * always does), clears on a brand-new tab/window. Read in a mount-only effect
 * (not the `useState` initializer) — matches `editor-coach-marks.tsx`'s pattern —
 * so server and the client's first render both start `hidden=false`, avoiding a
 * hydration mismatch; a real client-only value read there would diverge from SSR.
 */
export function EditorAdvisoryBanner({ onCopyLink, onVisibleChange }: EditorAdvisoryBannerProps) {
    const { t } = useI18n()
    const [hidden, setHidden] = useState(false)

    useEffect(() => {
        if (sessionStorage.getItem(DISMISS_KEY) === 'true') {
            setHidden(true)
            onVisibleChange?.(false)
            return
        }
        onVisibleChange?.(true)
        // TODO(analytics): view_mobile_editor_warning
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (hidden) return null

    const handleCopyLink = () => {
        // TODO(analytics): click_copy_link_mobile_editor
        onCopyLink()
    }

    const handleDismiss = () => {
        // TODO(analytics): close_mobile_editor_warning
        sessionStorage.setItem(DISMISS_KEY, 'true')
        setHidden(true)
        onVisibleChange?.(false)
    }

    return (
        <div
            role="region"
            aria-label={t.editor.advisoryBanner.title}
            className="relative z-20 flex shrink-0 items-start gap-2.5 border-t border-[var(--editor-border)] bg-[var(--editor-surface)] px-3.5 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
        >
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--editor-text)]">{t.editor.advisoryBanner.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--editor-text-muted)]">
                    {t.editor.advisoryBanner.description}
                </p>
                <button
                    type="button"
                    onClick={handleCopyLink}
                    className="mt-2 flex h-9 min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--editor-border)] bg-[var(--editor-overlay-bg)] px-3 text-xs font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)]"
                >
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                    {t.editor.advisoryBanner.copyLink}
                </button>
            </div>
            <button
                type="button"
                onClick={handleDismiss}
                aria-label={t.editor.advisoryBanner.dismiss}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--editor-text-muted)] transition-colors hover:bg-[var(--editor-overlay-hover)] hover:text-[var(--editor-text)]"
            >
                <X className="h-4 w-4" aria-hidden />
            </button>
        </div>
    )
}
