'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'

import { useI18n } from '@/i18n'
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll'
import { V2IntroVideo } from './V2IntroVideo'

/**
 * "Your store has moved to Web Store" announcement with the V2 intro video.
 * Shown while the user's has_seen_ai_wizard is false (gated by the dashboard layout).
 * Every close path — X, backdrop, Esc, Get started — persists the dismissal, so it
 * never comes back once closed.
 */
export function AIDiscoveryWizard({ userId }: { userId?: number | string }) {
  const { t } = useI18n()
  const copy = t.onboarding.v2Intro
  const [isOpen, setIsOpen] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Esc that exits video full screen must not also close the popup
  const fullscreenChangedAt = useRef(0)

  useLockBodyScroll(isOpen)

  const close = useCallback(() => {
    dialogRef.current?.querySelector('video')?.pause()
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setIsOpen(false)

    if (userId) {
      fetch('/api/user/dismiss-wizard', {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        console.error('Failed to persist wizard dismiss state', error)
      })
    }

    // PushOptInPrompt waits for this before taking its turn
    window.dispatchEvent(new CustomEvent('wizard-closed', { detail: { permanent: true } }))
  }, [userId])

  useEffect(() => {
    if (!isOpen) return
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.fullscreenElement) return
      if (Date.now() - fullscreenChangedAt.current < 600) return
      close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  const onFullscreenChange = useCallback(() => {
    fullscreenChangedAt.current = Date.now()
  }, [])

  if (!isOpen) return null

  return (
    <div className="dash-shell">
      <div
        onClick={close}
        className="fixed inset-0 z-[100] flex overflow-y-auto bg-black/40 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 backdrop-blur-[4px] animate-[fadeIn_.2s_ease-out] dark:bg-black/60"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="v2-intro-title"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          // Width follows the viewport height so the 16:9 video + copy fit without scrolling
          style={{ maxWidth: 'clamp(560px, calc((100vh - 360px) * 1.7778 + 66px), 960px)' }}
          className="relative m-auto w-full flex-none overflow-hidden rounded-[20px] border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[0_25px_50px_-12px_rgba(0,0,0,.5)] outline-none animate-[wizardFadeIn_.25s_ease-out]"
        >
          <div className="px-8 pt-7">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-blue-500/[.28] bg-blue-500/[.12] px-2.5 text-xs font-semibold leading-4 tracking-[.02em] text-blue-700 dark:text-blue-400">
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                {copy.badge}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label={copy.close}
                className="-mr-2 flex size-9 flex-none items-center justify-center rounded-lg border-0 bg-transparent text-[var(--dash-text-muted)] transition-colors duration-150 hover:bg-black/[.06] hover:text-[var(--dash-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 dark:hover:bg-white/[.06]"
              >
                <X className="size-[18px]" aria-hidden />
              </button>
            </div>
            <h2 id="v2-intro-title" className="mt-4 font-heading text-[28px] font-bold leading-[34px] text-[var(--dash-text)] [text-wrap:balance]">
              {copy.title}
            </h2>
            <p className="mt-2.5 text-[15px] leading-6 text-[var(--dash-text-muted)] [text-wrap:pretty]">
              {copy.description}
            </p>
          </div>

          <div className="px-8 pt-6">
            <div className="overflow-hidden rounded-[14px] border border-[var(--dash-border)] bg-[var(--dash-bg)]">
              <V2IntroVideo onFullscreenChange={onFullscreenChange} />
            </div>
          </div>

          <div className="grid gap-3 px-8 pb-7 pt-6">
            <button
              type="button"
              onClick={close}
              className="flex h-11 items-center justify-center gap-2 justify-self-end rounded-xl border-0 bg-gradient-to-r from-blue-500 to-teal-400 px-5 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(45,212,191,.55),inset_0_1px_0_rgba(255,255,255,.2)] transition-[filter,transform] duration-200 hover:brightness-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dash-surface)] active:scale-[.99]"
            >
              {copy.getStarted}
              <ArrowRight className="size-[15px]" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
