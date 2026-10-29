'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { Clock, Maximize, Minimize, RotateCcw, Volume2, VolumeX } from 'lucide-react'

import { useI18n } from '@/i18n'
import { V2_INTRO_MEDIA, bufferedFraction, canPreloadVideo, currentConnection, whenIdle } from './v2-intro-media'
import { V2IntroVideoCover } from './V2IntroVideoCover'
import { useV2IntroInline } from './use-v2-intro-inline'

export const formatTime = (t: number) => {
  const s = Math.max(0, Math.floor(Number.isFinite(t) ? t : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const stop = (e: MouseEvent | PointerEvent) => e.stopPropagation()

const CONTROLS_IDLE_MS = 2500

const ctrlBtn =
  'flex size-8 flex-none items-center justify-center rounded-lg border-0 bg-transparent p-0 transition-[background-color,color,transform] duration-150 hover:bg-white/[.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70'

/**
 * Custom player for the V2 intro video: poster first, one glass control bar; while playing the bar hides once the pointer
 * rests (it would sit on the burned-in subtitles) and comes back on pointer move, tap or keyboard focus.
 * Loading: metadata on open, full buffering once the browser is idle (skipped on Save-Data / 2G) or when the user
 * reaches for Play; shimmer until the poster paints, spinner while playback waits for data.
 *
 * `variant="inline"` (Help Center): the frame itself is the play button with an idle cover (V2IntroVideoCover), the bar
 * only shows while playing, keyboard shortcuts on the focused frame, resume from the saved position, pause when
 * scrolled away, and a retry on load errors.
 */
export function V2IntroVideo({
  onFullscreenChange,
  onDurationChange,
  variant = 'dialog',
}: {
  onFullscreenChange?: () => void
  /** Duration in seconds once metadata is read */
  onDurationChange?: (seconds: number) => void
  variant?: 'dialog' | 'inline'
}) {
  const { t } = useI18n()
  const copy = t.onboarding.v2Intro
  const inline = variant === 'inline'
  // Help Center copy — only the inline variant reads it
  const intro = inline ? t.help.overview.intro : null
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posterRef = useRef<HTMLImageElement>(null)
  const seeking = useRef(false)
  // Play was pressed — from now on "waiting"/"stalled" mean the user is actually waiting
  const playRequested = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  // Pointer moved over the player recently — the bar sits on the burned-in subtitles, so it hides again when the pointer rests
  const [awake, setAwake] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Pointer or keyboard focus is on the bar — keep it up
  const onBar = useRef({ pointer: false, focus: false })
  const [buffering, setBuffering] = useState(false)
  const [missing, setMissing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [preload, setPreload] = useState<'metadata' | 'auto'>('metadata')
  const [posterReady, setPosterReady] = useState(false)
  // Hide the poster only once real frames are playing, so there's no black flash while the video loads
  const [hasPlayed, setHasPlayed] = useState(false)
  const [hover, setHover] = useState(false)
  const extras = useV2IntroInline(inline, videoRef, playerRef)

  useEffect(() => {
    if (duration > 0) onDurationChange?.(duration)
  }, [duration, onDurationChange])

  // Buffer the start while the user reads the popup, unless they asked to save data
  useEffect(() => {
    if (!canPreloadVideo(currentConnection())) return
    return whenIdle(() => setPreload('auto'))
  }, [])

  // The poster can finish loading before hydration attaches onLoad
  useEffect(() => {
    if (posterRef.current?.complete && posterRef.current.naturalWidth > 0) setPosterReady(true)
  }, [])

  const bufferNow = (force = false) => {
    if (force || canPreloadVideo(currentConnection())) setPreload('auto')
  }

  // Metadata can load before hydration attaches onLoadedMetadata — read it once on mount
  useEffect(() => {
    const v = videoRef.current
    if (v && v.readyState >= 1 && Number.isFinite(v.duration)) setDuration(v.duration)
    // NETWORK_NO_SOURCE: every <source> already failed before hydration
    if (v?.error || v?.networkState === 3) setMissing(true)
  }, [])

  useEffect(() => {
    const onFs = () => {
      setFullscreen(!!document.fullscreenElement && document.fullscreenElement === playerRef.current)
      onFullscreenChange?.()
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [onFullscreenChange])

  useEffect(() => () => clearTimeout(idleTimer.current), [])

  const wake = () => {
    setAwake(true)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => { if (!onBar.current.pointer && !onBar.current.focus && !seeking.current) setAwake(false) }, CONTROLS_IDLE_MS)
  }

  const sleep = () => {
    clearTimeout(idleTimer.current)
    setAwake(false)
  }

  // Inline: idle shows only the clean cover; the bar belongs to playback
  const showControls = !missing && (inline ? playing && awake : !playing || awake)
  const progress = duration > 0 ? Math.min(1, current / duration) : 0

  const togglePlay = (e?: MouseEvent) => {
    e?.stopPropagation()
    const v = videoRef.current
    if (missing || !v) return
    if (v.paused || v.ended) {
      setStarted(true)
      playRequested.current = true
      bufferNow(true)
      // HAVE_FUTURE_DATA: enough to start; below that the user waits — show the spinner straight away
      if (v.readyState < 3) setBuffering(true)
      v.play()?.catch(() => { setPlaying(false); setBuffering(false) })
    } else {
      v.pause()
    }
  }

  const toggleMute = (e?: MouseEvent) => {
    e?.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  const toggleFullscreen = (e?: MouseEvent) => {
    e?.stopPropagation()
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

  // Inline frame shortcuts: Space / Enter / K play–pause, ← / → seek 5s, M mute, F full screen (Esc is native)
  const onFrameKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key
    if ((k === ' ' || k === 'Enter') && e.target !== e.currentTarget) return // let focused bar buttons handle it
    if (k === ' ' || k === 'Enter' || k === 'k' || k === 'K') { e.preventDefault(); togglePlay(); wake(); return }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { if (e.target === e.currentTarget) { onSeekKey(e); wake() } return }
    if (k === 'm' || k === 'M') { e.preventDefault(); toggleMute(); wake(); return }
    if (k === 'f' || k === 'F') { e.preventDefault(); toggleFullscreen() }
  }

  const retry = (e: MouseEvent) => {
    e.stopPropagation()
    setMissing(false)
    videoRef.current?.load()
  }

  const playLabel = playing ? copy.video.pause : ended ? copy.video.replay : copy.video.play
  const durationText = duration > 0 ? formatTime(duration) : ''
  // Fresh visit after finishing last time counts as "watched": Replay, no pulse
  const watched = ended || (!started && extras.saved.done)
  const resumeAt = started ? current : extras.saved.t
  const frameLabel = !intro ? undefined : playing
    ? copy.video.pause
    : `${watched ? copy.video.replay : resumeAt > 1 ? intro.resume : copy.video.play}: ${intro.title}${durationText ? `, ${durationText}` : ''}`
  const onWaitingForData = () => { if (playRequested.current) setBuffering(true) }
  const updateBuffered = (v: HTMLVideoElement) => setBuffered(bufferedFraction(v))
  const onMediaError = () => { setMissing(true); setPlaying(false); setBuffering(false) }

  return (
    <div
      ref={playerRef}
      onClick={togglePlay}
      onPointerMove={wake}
      onPointerDown={wake}
      onMouseEnter={inline ? () => setHover(true) : undefined}
      onMouseLeave={() => { sleep(); setHover(false) }}
      {...(inline ? { role: 'button', tabIndex: 0, 'aria-label': frameLabel, onKeyDown: onFrameKey } : {})}
      className={`relative aspect-video cursor-pointer select-none overflow-hidden bg-black ${inline
        ? `border border-solid border-white/10 outline-none transition-shadow duration-200 focus-visible:shadow-[0_0_0_2px_hsl(var(--card)),0_0_0_4px_hsl(var(--primary))] ${fullscreen ? 'rounded-none' : 'rounded-2xl'}`
        : ''}`}
    >
      <video
        ref={videoRef}
        preload={preload}
        playsInline
        className="absolute inset-0 block size-full bg-black object-contain"
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); extras.onLoadedMetadata(e.currentTarget) }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          if (!seeking.current) setCurrent(e.currentTarget.currentTime)
          updateBuffered(e.currentTarget)
          extras.onTimeUpdate(e.currentTarget)
        }}
        onProgress={(e) => updateBuffered(e.currentTarget)}
        onPlay={() => { setPlaying(true); setStarted(true); setEnded(false) }}
        onPause={(e) => { setPlaying(false); extras.onPause(e.currentTarget) }}
        onWaiting={onWaitingForData}
        onStalled={onWaitingForData}
        onPlaying={() => { setBuffering(false); setHasPlayed(true) }}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => { setPlaying(false); setEnded(true); extras.onEnded() }}
        // React bubbles <source> errors up here; an earlier source failing only means the browser tries the next one
        onError={(e) => { if (e.target === e.currentTarget) onMediaError() }}
      >
        {V2_INTRO_MEDIA.sources.map((s, i, all) => (
          <source
            key={s.src}
            src={s.src}
            type={s.type}
            media={s.media}
            // With <source> children the error fires on the last source, not on the video
            onError={i === all.length - 1 ? onMediaError : undefined}
          />
        ))}
      </video>

      {intro && !playing && !missing && (
        <V2IntroVideoCover
          hover={hover}
          fresh={!started && !extras.saved.done && !(extras.saved.t > 1)}
          ended={watched}
          progress={!watched && duration > 0 && resumeAt > 1 ? resumeAt / duration : 0}
          durationChip={durationText ? intro.durationChip.replace('{d}', durationText) : ''}
          tag={intro.tag}
        />
      )}

      {/* Poster as a real image: preloaded with the popup and shown until the first frame plays */}
      {!inline && <picture className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${hasPlayed ? 'opacity-0' : 'opacity-100'}`}>
        <source srcSet={V2_INTRO_MEDIA.posterWebp} type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- poster must be the exact preloaded file */}
        <img
          ref={posterRef}
          src={V2_INTRO_MEDIA.posterJpg}
          alt=""
          width={V2_INTRO_MEDIA.posterWidth}
          height={V2_INTRO_MEDIA.posterHeight}
          fetchPriority="high"
          decoding="async"
          onLoad={() => setPosterReady(true)}
          className="block size-full object-contain"
        />
      </picture>}

      {!inline && !posterReady && !missing && (
        <span
          aria-hidden
          data-testid="v2-intro-shimmer"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,#0f172a_30%,#1e293b_50%,#0f172a_70%)] bg-[length:200%_100%] motion-safe:animate-shimmer"
        />
      )}

      {buffering && !missing && (
        <span role="status" className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -ml-7 -mt-7 flex size-14 items-center justify-center rounded-full bg-slate-950/60 backdrop-blur-sm">
          {/* Static partial ring under prefers-reduced-motion */}
          <span aria-hidden className="size-8 rounded-full border-[3px] border-solid border-white/25 border-t-white motion-safe:animate-spin" />
          <span className="sr-only">{copy.loadingVideo}</span>
        </span>
      )}

      {missing && intro && (
        <div onClick={stop} className="absolute inset-0 z-[4] flex cursor-default flex-col items-center justify-center gap-3 bg-[rgba(2,6,23,.72)] p-4 text-center">
          <span className="text-sm font-medium leading-5 text-white">{intro.error}</span>
          <button
            type="button"
            onClick={retry}
            className="h-8 rounded-lg border border-solid border-white/[.22] bg-white/[.08] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/70"
          >
            {intro.retry}
          </button>
        </div>
      )}

      {missing && !inline && (
        <div className="absolute inset-0 flex cursor-default items-center justify-center bg-slate-950/45 p-3">
          <span className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-solid border-white/[.22] bg-[rgba(8,20,40,.62)] px-4 text-sm font-medium text-white backdrop-blur-md">
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
        data-testid="v2-intro-controls"
        onClick={stop}
        onPointerEnter={() => { onBar.current.pointer = true }}
        onPointerLeave={() => { onBar.current.pointer = false; wake() }}
        // Keyboard focus only — a mouse click on Play focuses it too, and that must not pin the bar over the subtitles
        onFocus={(e) => { onBar.current.focus = e.target.matches(':focus-visible'); wake() }}
        onBlur={() => { onBar.current.focus = false; wake() }}
        className={`absolute inset-x-3 bottom-3 z-[2] flex cursor-default items-center gap-2 transition-[opacity,transform] duration-[250ms] ${showControls ? 'pointer-events-auto opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
      >
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-solid border-white/10 bg-slate-950/[.62] px-1.5 backdrop-blur-[10px]">
          <button
            type="button"
            onClick={togglePlay}
            onPointerEnter={() => bufferNow()}
            onFocus={() => bufferNow()}
            onPointerDown={() => bufferNow(true)}
            aria-label={playLabel}
            className={`${ctrlBtn} text-white active:scale-[.94]`}
          >
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
              <span data-testid="v2-intro-buffered" className="absolute inset-y-0 left-0 rounded-full bg-white/[.28] transition-[width] duration-300" style={{ width: `${buffered * 100}%` }} />
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
