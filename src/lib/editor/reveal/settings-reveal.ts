/**
 * In the Settings panel: the field a reveal points at — by its marker
 * (`data-settings-focus="seoTitle"`), else the input showing the field's value
 * (section fields are hand-written per block type and carry no marker) — is
 * scrolled to, pulsed and focused.
 */

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()

const FIELDS = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]'

function fieldValue(el: HTMLElement): string {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value
    return el.textContent ?? ''
}

export function findSettingsField(root: ParentNode, hint: { focus?: string; value?: string }): HTMLElement | null {
    if (hint.focus) {
        const marked = root.querySelector<HTMLElement>(`[data-settings-focus="${CSS.escape(hint.focus)}"]`)
        if (marked) return marked
    }
    const wanted = hint.value ? normalize(hint.value.replace(/[…]+$/, '')) : ''
    if (wanted.length < 2) return null
    const fields = [...root.querySelectorAll<HTMLElement>(FIELDS)]
    return (
        fields.find((el) => normalize(fieldValue(el)) === wanted) ??
        fields.find((el) => normalize(fieldValue(el)).startsWith(wanted)) ??
        null
    )
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** Scrolls the field into view, pulses its outline twice and focuses it (without scrolling again). */
export function pulseSettingsField(el: HTMLElement): void {
    const focusable = el.matches(FIELDS) ? el : el.querySelector<HTMLElement>(FIELDS) ?? el
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
    focusable.focus({ preventScroll: true })
    if (reducedMotion() || typeof el.animate !== 'function') return
    el.animate(
        [
            { boxShadow: '0 0 0 0 rgba(45,212,191,0)' },
            { boxShadow: '0 0 0 2px #2dd4bf, 0 0 0 6px rgba(45,212,191,0.25)', offset: 0.4 },
            { boxShadow: '0 0 0 0 rgba(45,212,191,0)' },
        ],
        { duration: 1600, iterations: 2, easing: 'cubic-bezier(.32,.72,0,1)' },
    )
}

/**
 * The panel renders the field after a tab switch or a section change: look
 * for it for up to `waitMs`, then pulse it. Returns a cancel function.
 */
export function revealSettingsField(root: () => ParentNode | null, hint: { focus?: string; value?: string }, waitMs = 1500): () => void {
    let stopped = false
    const started = Date.now()
    let timer: number | undefined
    const tick = () => {
        if (stopped) return
        const panel = root()
        const field = panel ? findSettingsField(panel, hint) : null
        if (field) return pulseSettingsField(field)
        if (Date.now() - started < waitMs) timer = window.setTimeout(tick, 120)
    }
    timer = window.setTimeout(tick, 120)
    return () => {
        stopped = true
        if (timer !== undefined) window.clearTimeout(timer)
    }
}
