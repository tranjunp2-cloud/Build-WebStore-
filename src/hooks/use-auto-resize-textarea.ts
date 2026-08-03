import { useLayoutEffect, type RefObject } from 'react'

/**
 * Auto-grows a textarea to fit its content and remeasures when its rendered width changes.
 * When `value` is empty, `placeholder`
 * (if given) is measured instead — an empty textarea's scrollHeight ignores how many
 * lines the placeholder actually wraps to, so without this the box can end up too
 * short to show a multi-line placeholder in full.
 */
export function useAutoResizeTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight = 160, placeholder = '') {
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return

        const resize = () => {
            const measuringPlaceholder = !value && placeholder
            const original = el.value
            if (measuringPlaceholder) el.value = placeholder
            el.style.height = 'auto'
            el.style.overflowY = 'hidden'
            const borderHeight = el.offsetHeight - el.clientHeight
            const requiredHeight = el.scrollHeight + borderHeight
            const next = Math.min(requiredHeight, maxHeight)
            el.style.height = String(next) + 'px'
            el.style.overflowY = requiredHeight > maxHeight ? 'auto' : 'hidden'
            if (measuringPlaceholder) el.value = original
        }

        resize()

        if (typeof ResizeObserver === 'undefined') return
        let previousWidth = el.getBoundingClientRect().width
        const observer = new ResizeObserver(([entry]) => {
            const nextWidth = entry?.contentRect.width ?? el.getBoundingClientRect().width
            if (Math.abs(nextWidth - previousWidth) < 0.5) return
            previousWidth = nextWidth
            resize()
        })
        observer.observe(el)

        return () => observer.disconnect()
    }, [ref, value, maxHeight, placeholder])
}
