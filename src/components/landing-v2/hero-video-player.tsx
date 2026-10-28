import { V2_INTRO_MEDIA } from '@/components/dashboard/v2-intro-media'
import { Ic } from './lv-icon'
import { formatVideoTime, useHeroVideo } from './use-hero-video'
import type { LvCopy } from './lv-types'

const PLAY_PATH = 'M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z'
const SPEAKER_PATH = 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z'
const svgStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** Intro video with custom controls. Source list/poster come from V2_INTRO_MEDIA (shared with the dashboard dialog). */
export function HeroVideoPlayer({ copy }: { copy: LvCopy['hero'] }) {
  const p = useHeroVideo()
  const { state: s } = p
  const L = copy.video
  const playLabel = s.playing ? L.pause : s.ended ? L.replay : L.play

  return (
    <div
      ref={p.playerRef}
      className="player"
      data-state={s.missing ? 'error' : s.started ? 'started' : 'idle'}
      data-playing={s.playing ? '1' : '0'}
      data-ended={s.ended ? '1' : '0'}
      data-muted={s.muted ? '1' : '0'}
      data-hover={s.hover ? '1' : '0'}
      data-poster={s.posterShown ? '1' : '0'}
      onClick={p.toggle}
      onMouseEnter={() => p.setHover(true)}
      onMouseLeave={() => p.setHover(false)}
    >
      <video
        ref={p.videoRef}
        preload="metadata"
        playsInline
        {...p.videoEvents}
        // React bubbles <source> errors here; an earlier source failing only means the browser tries the next one
        onError={(e) => { if (e.target === e.currentTarget) p.onMediaError() }}
      >
        {V2_INTRO_MEDIA.sources.map((src, i, all) => (
          <source
            key={src.src}
            src={src.src}
            type={src.type}
            media={src.media}
            // With <source> children the error fires on the last source, not on the video
            onError={i === all.length - 1 ? p.onMediaError : undefined}
          />
        ))}
      </video>
      <picture className="v-poster">
        <source srcSet={V2_INTRO_MEDIA.posterWebp} type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- poster must be the exact preloaded file */}
        <img
          src={V2_INTRO_MEDIA.posterJpg}
          alt=""
          width={V2_INTRO_MEDIA.posterWidth}
          height={V2_INTRO_MEDIA.posterHeight}
          fetchPriority="high"
          decoding="async"
        />
      </picture>

      <div className="v-idle">
        {/* Click bubbles to the player, which starts playback; the button gives keyboard users a real Play control */}
        <button type="button" className="v-big" aria-label={L.play}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}><path d={PLAY_PATH} /></svg>
        </button>
        <span className="v-watch">{L.watch}</span>
      </div>
      <div className="v-err"><span className="v-err-chip"><Ic n="clock" s={15} /><span>{copy.soon}</span></span></div>

      <div className="v-ctl" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="v-btn v-play" onClick={p.toggle} aria-label={playLabel}>
          <svg className="g-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.2" /><rect x="13.5" y="4" width="4.5" height="16" rx="1.2" /></svg>
          <svg className="g-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={PLAY_PATH} /></svg>
          <Ic n="rotate-ccw" s={16} className="g-replay" />
        </button>
        <div
          ref={p.trackRef}
          className="v-track"
          role="slider"
          tabIndex={0}
          aria-label={copy.seek}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p.pct)}
          aria-valuetext={`${formatVideoTime(p.current)} / ${formatVideoTime(p.duration)}`}
          {...p.track}
        >
          <span className="v-rail"><span className="v-fill" style={{ width: `${p.pct}%` }} /></span>
        </div>
        <span className="v-time">{formatVideoTime(p.current)}<span className="v-dur"> / {formatVideoTime(p.duration)}</span></span>
        <button type="button" className="v-btn v-mute" onClick={p.toggleMute} aria-label={s.muted ? L.unmute : L.mute}>
          <svg className="g-sound" width="16" height="16" viewBox="0 0 24 24" {...svgStroke}>
            <path d={SPEAKER_PATH} /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
          </svg>
          <svg className="g-muted" width="16" height="16" viewBox="0 0 24 24" {...svgStroke}>
            <path d={SPEAKER_PATH} /><line x1="22" x2="16" y1="9" y2="15" /><line x1="16" x2="22" y1="9" y2="15" />
          </svg>
        </button>
        <button type="button" className="v-btn v-fs" onClick={p.toggleFullscreen} aria-label={s.fullscreen ? L.exitFullscreen : L.fullscreen}>
          <svg width="16" height="16" viewBox="0 0 24 24" {...svgStroke}>
            <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>
    </div>
  )
}
