/**
 * Inline font-size helpers for the editor preview iframe (F05 / GH-2089).
 *
 * `document.execCommand('fontSize')` only accepts the legacy 1-7 scale. We apply the
 * marker size 7 and then rewrite whatever the browser produced into a real px value.
 * Depending on `styleWithCSS` / browser the marker is serialized as:
 *   - `<font size="7">`                              (styleWithCSS=false)
 *   - `<span style="font-size: xxx-large">`          (Chrome, styleWithCSS=true)
 *   - `<span style="font-size: -webkit-xxx-large">`  (Safari/older WebKit)
 */

export const FONT_SIZE_MARKER_SELECTOR =
    'font[size="7"], span[style*="xxx-large"]'

/** Parse a toolbar value into a positive finite px number, or null. */
export function parseFontSizePx(val: string): number | null {
    const px = parseFloat(val)
    return Number.isFinite(px) && px > 0 ? px : null
}

/**
 * Rewrite execCommand fontSize markers inside `root` to `font-size: {px}px` spans.
 * When `range` is given, only markers intersecting it are patched so pre-existing
 * spans elsewhere in `root` keep their size. Returns the number of patched elements.
 */
export function patchFontSizeMarkers(root: HTMLElement, px: number, range?: Range | null): number {
    const scoped = range && !range.collapsed ? range : null
    const markers = Array.from(root.querySelectorAll<HTMLElement>(FONT_SIZE_MARKER_SELECTOR))
        .filter((el) => !scoped || scoped.intersectsNode(el))
    markers.forEach((el) => {
        let target = el
        if (el.tagName === 'FONT') {
            // Replace legacy <font> with a span, keeping children
            const span = el.ownerDocument.createElement('span')
            while (el.firstChild) span.appendChild(el.firstChild)
            el.replaceWith(span)
            target = span
        } else {
            el.removeAttribute('size')
        }
        // Drop stale font-size on nested nodes so the new size wins
        target.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((child) => {
            child.style.fontSize = ''
        })
        target.style.fontSize = `${px}px`
    })
    return markers.length
}
