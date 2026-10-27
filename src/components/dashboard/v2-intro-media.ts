// V2 intro video assets + loading helpers. File names carry a content hash so
// /videos/* can be cached as immutable (next.config.ts headers()).

export const V2_INTRO_MEDIA = {
  /** AV1 + Opus — smallest; browsers without AV1 fall through to the MP4 */
  webm: '/videos/v2-intro.797fa6f7.webm',
  webmType: 'video/webm; codecs="av01.0.05M.08, opus"',
  /** H.264 High + AAC — plays everywhere */
  mp4: '/videos/v2-intro.353eb55a.mp4',
  mp4Type: 'video/mp4; codecs="avc1.640028, mp4a.40.2"',
  posterWebp: '/videos/v2-intro-poster.58c9b524.webp',
  posterJpg: '/videos/v2-intro-poster.0d752135.jpg',
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
