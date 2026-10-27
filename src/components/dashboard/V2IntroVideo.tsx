'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { Clock, Maximize, Minimize, RotateCcw, Volume2, VolumeX } from 'lucide-react'

import { useI18n } from '@/i18n'

export const V2_INTRO_VIDEO_SRC = '/videos/v2-intro.mp4'
export const V2_INTRO_POSTER_SRC = '/videos/v2-intro-poster.jpg'

const formatTime = (t: number) => {
  const s = Math.max(0, Math.floor(Number.isFinite(t) ? t : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const stop = (e: MouseEvent | PointerEvent) => e.stopPropagation()

const ctrlBtn =
  'flex size-8 flex-none items-center justify-center rounded-lg border-0 bg-transparent p-0 transition-[background-color,color,transform] duration-150 hover:bg-white/[.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70'

/** Custom player for the V2 intro video: poster first, one glass control bar, controls hide while playing unless hovered. */
export function V2IntroVideo({ onFullscreenChange }: { onFullscreenChange?: () => void }) {
  const { t } = useI18n()
  const copy = t.onboarding.v2Intro
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const seeking = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [hover, setHover] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [missing, setMissing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  // Metadata can load before hydration attaches onLoadedMetadata — read it once on mount
  useEffect(() => {
    const v = videoRef.current
    if (v && v.readyState >= 1 && Number.isFinite(v.duration)) setDuration(v.duration)
    if (v?.error) setMissing(true)
  }, [])

  useEffect(() => {
    const onFs = () => {
      setFullscreen(!!document.fullscreenElement && document.fullscreenElement === playerRef.current)
      onFullscreenChange?.()
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [onFullscreenChange])

  const showControls = !missing && (!playing || hover)
  const progress = duration > 0 ? Math.min(1, current / duration) : 0

  const togglePlay = (e?: MouseEvent) => {
    e?.stopPropagation()
    const v = videoRef.current
    if (missing || !v) return
    if (v.paused || v.ended) {
      setStarted(true)
      v.play()?.catch(() => setPlaying(false))
    } else {
      v.pause()
    }
  }

  const toggleMute = (e: MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const toggleFullscreen = (e: MouseEvent) => {
    e.stopPropagation()
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      return
    }
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    const el = playerRef.current
    // iOS Safari has no element fullscreen — fall back to the native video player
    const ios = () => v?.webkitEnterFullscreen?.()
    if (!el?.requestFullscreen) return ios()
    el.requestFullscreen().catch(ios)
  }

  const seekTo = (fraction: number) => {
    const v = videoRef.current
    if (!v || !(v.duration > 0) || !Number.isFinite(v.duration)) return
    v.currentTime = Math.min(1, Math.max(0, fraction)) * v.duration
    setCurrent(v.currentTime)
  }

  const seekFromPointer = (e: PointerEvent) => {
    const r = trackRef.current?.getBoundingClientRect()
    if (r && r.width > 0) seekTo((e.clientX - r.left) / r.width)
  }

  const onSeekDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (missing) return
    seeking.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    seekFromPointer(e)
    setStarted(true)
  }

  const onSeekUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!seeking.current) return
    seeking.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  const onSeekKey = (e: KeyboardEvent) => {
    const v = videoRef.current
    if (!v || !(duration > 0)) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      seekTo((v.currentTime + (e.key === 'ArrowRight' ? 5 : -5)) / duration)
      setStarted(true)
    }
  }

  const playLabel = playing ? copy.video.pause : ended ? copy.video.replay : copy.video.play

  return (
    <div
      ref={playerRef}
      onClick={togglePlay}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative aspect-video cursor-pointer select-none overflow-hidden bg-black"
    >
      <video
        ref={videoRef}
        src={V2_INTRO_VIDEO_SRC}
        poster={V2_INTRO_POSTER_SRC}
        preload="metadata"
        playsInline
        className="absolute inset-0 block size-full bg-black object-contain"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => { if (!seeking.current) setCurrent(e.currentTarget.currentTime) }}
        onPlay={() => { setPlaying(true); setStarted(true); setEnded(false) }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => { setPlaying(false); setEnded(true) }}
        onError={() => { setMissing(true); setPlaying(false) }}
      />

      {playing && buffering && (
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -ml-5 -mt-5 size-10 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
      )}

      {missing && (
        <div className="absolute inset-0 flex cursor-default items-center justify-center bg-slate-950/45 p-3">
          <span className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-white/[.22] bg-[rgba(8,20,40,.62)] px-4 text-sm font-medium text-white backdrop-blur-md">
            <Clock className="size-[15px]" aria-hidden />
            {copy.videoComingSoon}
          </span>
        </div>
      )}

      {/* Thin progress line while playing with controls hidden */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[3px] bg-white/[.18] transition-opacity duration-[250ms] ${playing && !showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <span className="block h-full bg-gradient-to-r from-blue-500 to-teal-400" style={{ width: `${progress * 100}%` }} />
      </span>

      <div
        onClick={stop}
        className={`absolute inset-x-3 bottom-3 z-[2] flex cursor-default items-center gap-2 transition-[opacity,transform] duration-[250ms] ${showControls ? 'pointer-events-auto opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
      >
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-slate-950/[.62] px-1.5 backdrop-blur-[10px]">
          <button type="button" onClick={togglePlay} aria-label={playLabel} className={`${ctrlBtn} text-white active:scale-[.94]`}>
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="4" width="4.5" height="16" rx="1.2" /><rect x="13.5" y="4" width="4.5" height="16" rx="1.2" /></svg>
            ) : ended ? (
              <RotateCcw className="size-4" aria-hidden />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
            )}
          </button>

          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={copy.video.seek}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={`${formatTime(current)} / ${formatTime(duration)}`}
            onPointerDown={onSeekDown}
            onPointerMove={(e) => { if (seeking.current) seekFromPointer(e) }}
            onPointerUp={onSeekUp}
            onPointerCancel={onSeekUp}
            onKeyDown={onSeekKey}
            className="relative flex h-6 min-w-10 flex-1 cursor-pointer touch-none items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70"
          >
            <span className="relative block h-1 flex-1 rounded-full bg-white/[.22]">
              <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-teal-400" style={{ width: `${progress * 100}%` }} />
              <span
                className="absolute top-1/2 -ml-1.5 -mt-1.5 size-3 rounded-full bg-white shadow-[0_0_0_3px_rgba(45,212,191,.3),0_1px_4px_rgba(0,0,0,.45)]"
                style={{ left: `${progress * 100}%` }}
              />
            </span>
          </div>

          {started && (
            <span className="flex-none whitespace-nowrap text-xs font-medium tabular-nums leading-4 text-white">
              {formatTime(current)}
              <span className="text-white/60"> / {formatTime(duration)}</span>
            </span>
          )}

          <button type="button" onClick={toggleMute} aria-label={muted ? copy.video.unmute : copy.video.mute} className={`${ctrlBtn} text-white/85`}>
            {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? copy.video.exitFullScreen : copy.video.fullScreen} className={`${ctrlBtn} text-white/85`}>
            {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  )
}
