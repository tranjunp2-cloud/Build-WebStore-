// V2 intro video assets + loading helpers. File names carry a content hash so
// /videos/* can be cached as immutable (next.config.ts headers()).

/** Viewports above this get the 1080p encodes (dialog + full screen stay sharp); phones and tablets get 720p */
export const V2_INTRO_LARGE_SCREEN = '(min-width: 769px)'

export const V2_INTRO_MEDIA = {
  /**
   * H.264 High + AAC only: at the same sharpness AV1 wasn't smaller for this screen-recording video and it smeared the
   * fading burned-in subtitles. 1080p carries the media query, 720p doesn't — a browser that ignores `media` on <source>
   * picks 1080p (sharp, just heavier on a phone) instead of a soft 720p on desktop.
   */
  sources: [
    { src: '/videos/v2-intro-1080.348f3e19.mp4', type: 'video/mp4; codecs="avc1.640028, mp4a.40.2"', media: V2_INTRO_LARGE_SCREEN },
    { src: '/videos/v2-intro-720.e1052c5e.mp4', type: 'video/mp4; codecs="avc1.64001f, mp4a.40.2"' },
  ] as ReadonlyArray<{ src: string; type: string; media?: string }>,
  posterWebp: '/videos/v2-intro-poster.d75884bd.webp',
  posterJpg: '/videos/v2-intro-poster.3baf3b45.jpg',
  posterWidth: 1600,
  posterHeight: 900,
} as const

type ConnectionInfo = { saveData?: boolean; effectiveType?: string }

/** Buffer ahead only when the user hasn't asked to save data and the link isn't 2G-slow. */
export function canPreloadVideo(connection?: ConnectionInfo | null): boolean {
  if (!connection) return true
  if (connection.saveData) return false
  return connection.effectiveType !== '2g' && connection.effectiveType !== 'slow-2g'
}

export function currentConnection(): ConnectionInfo | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { connection?: ConnectionInfo }).connection ?? null
}

/** End of the buffered range that holds the playhead, as a 0–1 fraction of the duration. */
export function bufferedFraction(video: Pick<HTMLMediaElement, 'buffered' | 'currentTime' | 'duration'>): number {
  const { buffered, currentTime, duration } = video
  if (!(duration > 0) || !Number.isFinite(duration)) return 0
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= currentTime + 0.5 && currentTime <= buffered.end(i)) {
      return Math.min(1, buffered.end(i) / duration)
    }
  }
  return 0
}

/** Run `cb` once the browser is idle (setTimeout fallback for Safari). Returns a cancel function. */
export function whenIdle(cb: () => void, timeout = 2000): () => void {
  const w = typeof window === 'undefined' ? undefined : (window as Window & typeof globalThis)
  if (w?.requestIdleCallback) {
    const id = w.requestIdleCallback(cb, { timeout })
    return () => w.cancelIdleCallback(id)
  }
  const id = setTimeout(cb, 1200)
  return () => clearTimeout(id)
}
