'use client'

import { Clock, RotateCcw } from 'lucide-react'

import { V2_INTRO_MEDIA } from './v2-intro-media'

type Props = {
  /** Pointer is over the frame — sharper thumbnail, lighter shade, bigger Play */
  hover: boolean
  /** Never watched — pulse ring around Play */
  fresh: boolean
  /** Watched to the end — Replay instead of Play */
  ended: boolean
  /** Watched part (0–1) for a paused / half-watched video; 0 hides the line */
  progress: number
  /** "2:42 min" — empty until metadata is read */
  durationChip: string
  tag: string
}

const chip =
  'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border border-solid border-white/[.14] bg-[rgba(2,6,23,.66)] px-2.5 text-xs font-semibold tabular-nums leading-4 text-white backdrop-blur-[8px]'

/**
 * Idle face of the inline intro player (Help Center): blurred poster, glass Play / Replay, duration + tag chips and
 * how much was already watched. No control bar here — the whole frame is the play button.
 */
export function V2IntroVideoCover({ hover, fresh, ended, progress, durationChip, tag }: Props) {
  return (
    <div aria-hidden data-testid="v2-intro-cover" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <picture>
        <source srcSet={V2_INTRO_MEDIA.posterWebp} type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- same preloaded poster file as the popup */}
        <img
          src={V2_INTRO_MEDIA.posterJpg}
          alt=""
          width={V2_INTRO_MEDIA.posterWidth}
          height={V2_INTRO_MEDIA.posterHeight}
          decoding="async"
          draggable={false}
          // scale hides the blurred edge
          className={`block size-full object-cover object-top transition-[transform,filter] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${hover ? 'blur-[1px] motion-safe:scale-[1.07]' : 'scale-[1.04] blur-[2px]'}`}
        />
      </picture>

      <span
        className={`absolute inset-0 transition-[background] duration-300 ${hover
          ? 'bg-[linear-gradient(180deg,rgba(11,17,32,.12)_0%,rgba(11,17,32,.3)_55%,rgba(11,17,32,.85)_100%)]'
          : 'bg-[linear-gradient(180deg,rgba(11,17,32,.28)_0%,rgba(11,17,32,.42)_55%,rgba(11,17,32,.85)_100%)]'}`}
      />

      <span className="absolute left-1/2 top-1/2 -ml-8 -mt-8 size-16">
        {fresh && !hover && (
          <span data-testid="v2-intro-pulse" className="absolute inset-0 rounded-full border border-solid border-white/50 motion-safe:animate-intro-pulse motion-reduce:hidden" />
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full border border-solid text-[hsl(var(--primary))] shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur-[12px] transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(.22,1,.36,1)] ${hover ? 'border-white/[.32] bg-[rgba(15,23,42,.72)] motion-safe:scale-[1.06]' : 'border-white/20 bg-[rgba(15,23,42,.6)]'}`}
        >
          {ended ? (
            <RotateCcw className="size-6" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="ml-[3px]"><path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
          )}
        </span>
      </span>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        {durationChip ? (
          <span className={chip}>
            <Clock className="size-3" strokeWidth={2.2} />
            {durationChip}
          </span>
        ) : <span />}
        <span className={chip}>{tag}</span>
      </div>

      {progress > 0 && (
        <span
          data-testid="v2-intro-resume-line"
          className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-blue-500 to-teal-400"
          style={{ width: `${Math.min(1, progress) * 100}%` }}
        />
      )}
    </div>
  )
}
