'use client'

import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { readIntroProgress, resumePoint, writeIntroProgress } from './v2-intro-progress'
import type { IntroProgress } from './v2-intro-progress'

const SAVE_EVERY_MS = 3000
/** Pause once less than this share of the frame is on screen */
const MIN_VISIBLE = 0.25

/**
 * Behaviour the inline (Help Center) intro player adds on top of the popup player: remember where the user stopped
 * and pause when the frame scrolls out of view. Disabled for the popup — its handlers become no-ops.
 */
export function useV2IntroInline(
  enabled: boolean,
  videoRef: RefObject<HTMLVideoElement | null>,
  frameRef: RefObject<HTMLElement | null>,
) {
  const [saved, setSaved] = useState<IntroProgress>({ t: 0, done: false })
  const lastSave = useRef(0)
  const restored = useRef(false)

  // localStorage is client-only — read after mount so server and client render the same first frame
  useEffect(() => {
    if (enabled) setSaved(readIntroProgress())
  }, [enabled])

  const save = (p: IntroProgress, quiet = false) => {
    writeIntroProgress(p)
    lastSave.current = Date.now()
    if (!quiet) setSaved(p)
  }

  const saveFrom = (v: HTMLVideoElement, quiet = false) => {
    if (v.ended) save({ t: 0, done: true }, quiet)
    else if (v.currentTime > 1) save({ t: v.currentTime, done: false }, quiet)
  }

  useEffect(() => {
    const frame = frameRef.current
    if (!enabled || !frame || typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        const v = videoRef.current
        if (v && !v.paused && e.intersectionRatio < MIN_VISIBLE && !document.fullscreenElement) v.pause()
      }),
      { threshold: [0, MIN_VISIBLE, 0.5] },
    )
    io.observe(frame)
    return () => io.disconnect()
  }, [enabled, frameRef, videoRef])

  // Leaving Help Center (or switching tab) unmounts the player — keep the position
  useEffect(() => {
    if (!enabled) return
    const v = videoRef.current
    const onHide = () => { if (v && v.currentTime > 0) saveFrom(v, true) }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      onHide()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save helpers only touch refs + storage
  }, [enabled, videoRef])

  return {
    saved,
    onLoadedMetadata(v: HTMLVideoElement) {
      if (!enabled || restored.current) return
      restored.current = true
      const t = resumePoint(readIntroProgress(), v.duration)
      if (t > 0) v.currentTime = t
    },
    onTimeUpdate(v: HTMLVideoElement) {
      if (enabled && !v.paused && v.currentTime > 1 && Date.now() - lastSave.current > SAVE_EVERY_MS) saveFrom(v, true)
    },
    onPause(v: HTMLVideoElement) {
      if (enabled && !v.ended) saveFrom(v)
    },
    onEnded() {
      if (enabled) save({ t: 0, done: true })
    },
  }
}
