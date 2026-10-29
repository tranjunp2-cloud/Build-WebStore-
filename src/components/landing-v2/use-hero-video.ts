'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'

const SEEK_STEP_S = 5

export function formatVideoTime(s: number): string {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

type FsVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

/** State + handlers of the hero video player (idle overlay → controls bar after first play). */
export function useHeroVideo() {
  const playerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const seeking = useRef(false)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(false)
  const [hover, setHover] = useState(false)
  const [missing, setMissing] = useState(false)
  const [posterShown, setPosterShown] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  // Metadata/errors can land before hydration attaches handlers — read them once on mount
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration)
    // NETWORK_NO_SOURCE (3): every <source> already failed
    if (v.error || v.networkState === 3) setMissing(true)
  }, [])

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggle = useCallback((e?: MouseEvent) => {
    e?.stopPropagation()
    const v = videoRef.current
    if (missing || !v) return
    if (v.paused || v.ended) {
      setStarted(true)
      const p = v.play() as Promise<void> | undefined
      p?.catch(() => setPlaying(false))
    } else {
      v.pause()
    }
  }, [missing])

  const toggleMute = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const toggleFullscreen = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    const p = playerRef.current as FsElement | null
    const v = videoRef.current as FsVideo | null
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch(() => undefined)
      return
    }
    // iOS Safari only fullscreens the <video> itself
    const ios = () => { try { v?.webkitEnterFullscreen?.() } catch { /* unsupported */ } }
    const req = p?.requestFullscreen ?? p?.webkitRequestFullscreen
    if (!p || !req) return ios()
    try {
      const r = req.call(p)
      if (r && typeof r.catch === 'function') r.catch(ios)
    } catch {
      ios()
    }
  }, [])

  const paint = useCallback((time: number) => setCurrent(time), [])

  const seekFrom = useCallback((clientX: number) => {
    const v = videoRef.current
    const track = trackRef.current
    if (!v || !track || !(v.duration > 0) || !Number.isFinite(v.duration)) return
    const r = track.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / (r.width || 1)))
    v.currentTime = f * v.duration
    paint(v.currentTime)
  }, [paint])

  const onTrackPointerDown = (e: PointerEvent) => {
    e.stopPropagation()
    if (missing) return
    seeking.current = true
    try { trackRef.current?.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    seekFrom(e.clientX)
  }
  const onTrackPointerMove = (e: PointerEvent) => { if (seeking.current) seekFrom(e.clientX) }
  const onTrackPointerUp = (e: PointerEvent) => {
    if (!seeking.current) return
    seeking.current = false
    try { trackRef.current?.releasePointerCapture(e.pointerId) } catch { /* already released */ }
  }
  const onTrackKeyDown = (e: KeyboardEvent) => {
    const v = videoRef.current
    if (!v || !(v.duration > 0)) return
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    e.stopPropagation()
    const delta = e.key === 'ArrowRight' ? SEEK_STEP_S : -SEEK_STEP_S
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + delta))
    paint(v.currentTime)
  }

  const videoEvents = {
    onLoadedMetadata: (e: { currentTarget: HTMLVideoElement }) => {
      const d = e.currentTarget.duration
      if (Number.isFinite(d) && d > 0) setDuration(d)
    },
    onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) => { if (!seeking.current) paint(e.currentTarget.currentTime) },
    onPlay: () => { setPlaying(true); setStarted(true); setEnded(false) },
    onPlaying: () => setPosterShown(false),
    onPause: () => setPlaying(false),
    onEnded: () => { setPlaying(false); setEnded(true) },
  }
  const onMediaError = useCallback(() => { setMissing(true); setPlaying(false) }, [])

  const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0
  return {
    playerRef, videoRef, trackRef,
    state: { started, playing, ended, muted, hover, missing, posterShown, fullscreen },
    current, duration, pct,
    setHover, toggle, toggleMute, toggleFullscreen, onMediaError, videoEvents,
    track: { onPointerDown: onTrackPointerDown, onPointerMove: onTrackPointerMove, onPointerUp: onTrackPointerUp, onPointerCancel: onTrackPointerUp, onKeyDown: onTrackKeyDown },
  }
}
