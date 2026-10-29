// Watch progress of the inline intro video (Help Center). Kept per browser in localStorage —
// the onboarding popup never reads it, so replaying here doesn't touch onboarding state.

export const V2_INTRO_PROGRESS_KEY = 'pw-help-intro-video'

/** Resume only past this point (seconds) — anything earlier just starts over */
export const RESUME_MIN_SECONDS = 3

export type IntroProgress = { t: number; done: boolean }

const EMPTY: IntroProgress = { t: 0, done: false }

export function readIntroProgress(): IntroProgress {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(V2_INTRO_PROGRESS_KEY)
    if (!raw) return EMPTY
    const v = JSON.parse(raw) as Partial<IntroProgress>
    return { t: typeof v.t === 'number' && Number.isFinite(v.t) && v.t > 0 ? v.t : 0, done: v.done === true }
  } catch {
    // Private mode / blocked storage / corrupted value
    return EMPTY
  }
}

export function writeIntroProgress(p: IntroProgress): void {
  try {
    localStorage.setItem(V2_INTRO_PROGRESS_KEY, JSON.stringify(p))
  } catch {
    // Storage unavailable — progress just isn't remembered
  }
}

/** Saved position to seek to on load, or 0 when the video should start from the beginning */
export function resumePoint(p: IntroProgress, duration: number): number {
  if (p.done || !(duration > 0) || !Number.isFinite(duration)) return 0
  return p.t > RESUME_MIN_SECONDS && p.t < duration - 1 ? p.t : 0
}
