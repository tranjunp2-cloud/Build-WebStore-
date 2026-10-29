/**
 * Inside the preview iframe: find the exact thing a reveal points at in a
 * section (the button, the picture, the heading), outline it and say what it
 * is. The section renderers carry no field markers, so the element is found by
 * what it shows: the field's current text, or the picture's address.
 */

export type CanvasRevealHint = {
    /** the field's text as stored (exact), or the card's preview of it */
    text?: string
    /** the picture's address (or its file name) */
    src?: string
    /** dot path of the field — a list index picks the n-th picture */
    path?: string
}

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
/** the card's preview ends with "…" when it was cut */
const stripEllipsis = (value: string) => value.replace(/[…]+$|\.{3}$/, '').trim()

function ownText(el: Element): string {
    return normalize(el.textContent ?? '')
}

/** The smallest element whose whole text is `text` (else the smallest that starts with it). */
function byText(root: Element, text: string): HTMLElement | null {
    const wanted = normalize(stripEllipsis(text))
    if (wanted.length < 2) return null
    let exact: HTMLElement | null = null
    let prefix: HTMLElement | null = null
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.closest('[data-editor-control]')) continue
        const own = ownText(el)
        if (!own) continue
        // walking down the tree keeps the innermost match
        if (own === wanted) exact = el
        else if (!exact && own.startsWith(wanted) && own.length <= wanted.length * 2) prefix = el
    }
    const hit = exact ?? prefix
    if (!hit) return null
    // a label inside a button / link: show the whole button
    return (hit.closest('a, button') as HTMLElement | null) ?? hit
}

const fileName = (src: string) => {
    try {
        return new URL(src, window.location.href).pathname.split('/').pop() ?? ''
    } catch {
        return src.split('/').pop() ?? ''
    }
}

function byPicture(root: Element, hint: CanvasRevealHint): HTMLElement | null {
    const pictures = [...root.querySelectorAll<HTMLElement>('img, picture, [style*="background-image"]')]
    if (pictures.length === 0) return null
    if (hint.src) {
        const name = fileName(hint.src)
        const match = pictures.find((el) => {
            const src = el instanceof HTMLImageElement ? el.currentSrc || el.src : el.style.backgroundImage
            return Boolean(name) && decodeURIComponent(src).includes(name)
        })
        if (match) return match
    }
    // "images.2.image" → the third picture of the section
    const index = hint.path?.split('.').find((part) => /^\d+$/.test(part))
    if (index !== undefined && pictures[Number(index)]) return pictures[Number(index)]!
    return null
}

/** The pictures of a whole list ("images"): the box around all of them. */
function pictureList(root: Element): HTMLElement | null {
    const pictures = [...root.querySelectorAll<HTMLElement>('img')]
    if (pictures.length < 2) return pictures[0] ?? null
    let common: HTMLElement | null = pictures[0]!.parentElement
    while (common && common !== root && !pictures.every((el) => common!.contains(el))) common = common.parentElement
    return common && common !== root ? common : null
}

const PICTURE_PATH = /(image|picture|photo|logo|background|avatar|gallery|images)(\.|$)/i

/** The thing inside `section` the hint names; the section itself when nothing more exact is found. */
export function findRevealElement(section: HTMLElement, hint: CanvasRevealHint): HTMLElement {
    const last = hint.path?.split('.').pop() ?? ''
    const isPicture = Boolean(hint.src) || PICTURE_PATH.test(last) || PICTURE_PATH.test(hint.path ?? '')
    if (isPicture) {
        const one = byPicture(section, hint)
        if (one) return one
        if (hint.path && !/\d/.test(hint.path)) return pictureList(section) ?? section
    }
    if (hint.text) {
        const hit = byText(section, hint.text)
        if (hit) return hit
    }
    // a button field with nothing to match (an empty url): the n-th button of the section
    const button = /(^|\.)(cta\w*|\w*buttons?)\.(\d+)(\.|$)/i.exec(hint.path ?? '')
    if (button) {
        const buttons = [...section.querySelectorAll<HTMLElement>('a, button')].filter((el) => !el.closest('[data-editor-control]'))
        const nth = buttons[Number(button[3])]
        if (nth) return nth
    }
    return section
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

let current: { remove: () => void } | null = null

/**
 * A ring around `el` (follows it while the page scrolls) and a small tag
 * above it ("AI changed · Button 1"). One at a time; fades after `holdMs`.
 * `quiet`: ring only, no tag, no entrance (hovering a chip).
 */
export function showRevealRing(el: HTMLElement, options: { label?: string; holdMs?: number; quiet?: boolean } = {}): () => void {
    current?.remove()
    const accent = '#2dd4bf'
    const ring = document.createElement('div')
    ring.setAttribute('aria-hidden', 'true')
    ring.style.cssText = `position:absolute;pointer-events:none;z-index:2147483000;border-radius:8px;box-shadow:0 0 0 2px ${accent},0 0 0 7px rgba(45,212,191,0.18);transition:opacity 400ms ease;opacity:1`
    const tag = options.label && !options.quiet ? document.createElement('div') : null
    if (tag) {
        tag.setAttribute('aria-hidden', 'true')
        tag.textContent = options.label!
        tag.style.cssText = `position:absolute;pointer-events:none;z-index:2147483001;transform:translateY(calc(-100% - 8px));max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;border-radius:6px;background:${accent};color:#0b1120;font:600 12px/1 Inter,system-ui,sans-serif;transition:opacity 400ms ease`
    }
    const place = () => {
        const rect = el.getBoundingClientRect()
        const top = rect.top + window.scrollY - 6
        const left = rect.left + window.scrollX - 6
        Object.assign(ring.style, { top: `${top}px`, left: `${left}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px` })
        if (tag) Object.assign(tag.style, { top: `${top}px`, left: `${left}px` })
    }
    place()
    document.body.appendChild(ring)
    if (tag) document.body.appendChild(tag)
    if (!options.quiet && !reducedMotion() && typeof ring.animate === 'function') {
        ring.animate(
            [
                { opacity: 0, boxShadow: `0 0 0 2px ${accent}, 0 0 0 22px rgba(45,212,191,0)` },
                { opacity: 1, boxShadow: `0 0 0 2px ${accent}, 0 0 0 7px rgba(45,212,191,0.18)` },
            ],
            { duration: 500, easing: 'cubic-bezier(.32,.72,0,1)' },
        )
    }
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    const timers: number[] = []
    const remove = () => {
        timers.forEach((t) => window.clearTimeout(t))
        window.removeEventListener('scroll', place)
        window.removeEventListener('resize', place)
        ring.remove()
        tag?.remove()
        if (current?.remove === remove) current = null
    }
    if (options.holdMs !== Infinity) {
        timers.push(window.setTimeout(() => {
            ring.style.opacity = '0'
            if (tag) tag.style.opacity = '0'
        }, options.holdMs ?? 2600))
        timers.push(window.setTimeout(remove, (options.holdMs ?? 2600) + 450))
    }
    current = { remove }
    return remove
}

export function clearRevealRing(): void {
    current?.remove()
}

export function scrollRevealIntoView(el: HTMLElement): void {
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
}
