import { useLayoutEffect, type RefObject } from 'react'

/**
 * Auto-grows a textarea to fit its content. When `value` is empty, `placeholder`
 * (if given) is measured instead — an empty textarea's scrollHeight ignores how many
 * lines the placeholder actually wraps to, so without this the box can end up too
 * short to show a multi-line placeholder in full.
 */
export function useAutoResizeTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight = 160, placeholder = '') {
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const measuringPlaceholder = !value && placeholder
        const original = el.value
        if (measuringPlaceholder) el.value = placeholder
        el.style.height = 'auto'
        const next = Math.min(el.scrollHeight, maxHeight)
        el.style.height = `${next}px`
        el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
        if (measuringPlaceholder) el.value = original
    }, [ref, value, maxHeight, placeholder])
}
