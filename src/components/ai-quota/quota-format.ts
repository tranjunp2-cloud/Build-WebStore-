/**
 * Shop-facing AI allowance ("AI battery"): pure helpers behind the header chip, its popover and the chat notice.
 * Source: GET /api/agent/usage (ai-platform, per shop, rolling 24 h). No dollars, no "requests" in anything shown.
 */

export interface AiUsage {
    ai: { leftPercent: number; nextFreeAt: string | null }
    pictures: { used: number; limit: number | null; nextFreeAt: string | null }
    paused: boolean
    plan: string | null
}

export type AiTone = 'ok' | 'low' | 'out'

/**
 * Whether shops see how much AI they have left (header chip, "almost out" chat line). Off for now: limits are set
 * quietly on the server (Payload plan-features) while real usage is collected; the used-up lock still shows.
 */
export const SHOW_AI_LEVEL = false

/** At or below this the chip turns amber and the chat shows the "almost out" line. */
export const LOW_PERCENT = 20

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)

/** The usage response, or null when it is not one (the UI then hides). */
export function parseAiUsage(body: unknown): AiUsage | null {
    if (!body || typeof body !== 'object') return null
    const b = body as Record<string, unknown>
    const ai = b.ai as Record<string, unknown> | undefined
    const pictures = b.pictures as Record<string, unknown> | undefined
    const left = num(ai?.leftPercent)
    const used = num(pictures?.used)
    if (left === null || used === null) return null
    const limit = pictures?.limit === null ? null : num(pictures?.limit)
    return {
        ai: { leftPercent: Math.max(0, Math.min(100, Math.round(left))), nextFreeAt: str(ai?.nextFreeAt) },
        pictures: { used: Math.max(0, used), limit: limit === null ? null : Math.max(0, limit), nextFreeAt: str(pictures?.nextFreeAt) },
        paused: b.paused === true,
        plan: str(b.plan),
    }
}

/** out: nothing left (or the platform paused AI); low: ≤ 20 % left. */
export function aiTone(usage: AiUsage): AiTone {
    if (usage.paused || usage.ai.leftPercent <= 0) return 'out'
    return usage.ai.leftPercent <= LOW_PERCENT ? 'low' : 'ok'
}

/** Pictures still available in the window; null = unlimited. */
export function picturesLeft(usage: AiUsage): number | null {
    return usage.pictures.limit === null ? null : Math.max(0, usage.pictures.limit - usage.pictures.used)
}

/** "14:20" in the viewer's clock, and whether that is on a later day than `now`. */
export function backAt(iso: string | null, now: Date = new Date(), locale?: string): { time: string; laterDay: boolean } | null {
    if (!iso) return null
    const at = new Date(iso)
    if (Number.isNaN(at.getTime())) return null
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(at)
    return { time, laterDay: at.toDateString() !== now.toDateString() }
}

export type PlanName = 'free' | 'starter' | 'standard' | 'professional'

/** SSO plan code → the plan's name the shop knows (TM and non-TM are the same plan). */
export function planName(code: string | null): PlanName | null {
    if (!code) return null
    if (code === 'FREEMIUM') return 'free'
    if (code.startsWith('STARTER')) return 'starter'
    if (code.startsWith('STANDARD')) return 'standard'
    if (code.startsWith('PROFESSIONAL')) return 'professional'
    return null
}

/** Battery icon for the level (lucide names). */
export function batteryIcon(usage: AiUsage): 'battery-full' | 'battery-medium' | 'battery-low' | 'battery-warning' {
    const pct = usage.paused ? 0 : usage.ai.leftPercent
    if (pct >= 90) return 'battery-full'
    if (pct > LOW_PERCENT) return 'battery-medium'
    return pct > 0 ? 'battery-low' : 'battery-warning'
}
