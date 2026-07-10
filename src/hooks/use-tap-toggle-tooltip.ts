import { useEffect, useRef, useState, type MouseEvent } from 'react'

/**
 * Radix Tooltip only opens on hover/focus — it intentionally ignores touch
 * pointers, so a trigger never opens on iPad/mobile taps. This makes the
 * trigger tap-to-toggle (closes on next outside tap). Desktop hover/focus-open
 * still works unchanged.
 *
 * Radix's TooltipTrigger composes its own `onClick: composeEventHandlers(props.onClick,
 * context.onClose)` — without preventDefault() that unconditionally re-closes right
 * after our handler runs, so a plain toggle never actually opens. Radix's trigger also
 * force-closes on its own onPointerDown whenever already open (its built-in "click
 * trigger again to close" behavior), which races with our toggle if we read `open` from
 * the click closure. wasOpenRef tracks the state onClick should toggle from, kept in sync
 * three ways: (1) onPointerDown captures pre-event state before either handler can mutate
 * it, for taps/clicks; (2) onFocus seeds it for pure-keyboard Tab-entry, which has no
 * pointerdown to sync from — gated on isPointerRef so it doesn't clobber (1) when a
 * pointer click also happens to focus the element; (3) onClick writes its own outcome
 * back, so repeated Enter/Space with no intervening pointer event still toggles correctly.
 *
 * onOpenChange is also routed through changeOpen() so wasOpenRef stays in sync when
 * something OTHER than our onClick changes `open` — e.g. Escape, which Radix closes via
 * onOpenChange directly. Without this, wasOpenRef stays stale after Escape and the next
 * Enter/click is a no-op (toggles to the same stale "from" state instead of reopening).
 *
 * Usage: `<Tooltip open={open} onOpenChange={onOpenChange}>` + `<TooltipTrigger asChild>
 * <button ref={ref} onPointerDown={onPointerDown} onFocus={onFocus} onClick={onClick}>`.
 */
export function useTapToggleTooltip<T extends HTMLElement = HTMLButtonElement>() {
    const [open, setOpen] = useState(false)
    const ref = useRef<T>(null)
    const wasOpenRef = useRef(false)
    const isPointerRef = useRef(false)

    const changeOpen = (next: boolean) => {
        wasOpenRef.current = next
        setOpen(next)
    }

    useEffect(() => {
        if (!open) return
        const onOutside = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) changeOpen(false)
        }
        document.addEventListener('pointerdown', onOutside)
        return () => document.removeEventListener('pointerdown', onOutside)
    }, [open])

    const onPointerDown = () => {
        wasOpenRef.current = open
        isPointerRef.current = true
    }
    const onFocus = () => {
        if (!isPointerRef.current) wasOpenRef.current = true
    }
    const onClick = (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const next = !wasOpenRef.current
        wasOpenRef.current = next
        isPointerRef.current = false
        setOpen(next)
    }

    return { open, onOpenChange: changeOpen, onPointerDown, onFocus, onClick, ref }
}
