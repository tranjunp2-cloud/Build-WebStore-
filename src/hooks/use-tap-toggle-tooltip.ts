import { useEffect, useRef, useState } from 'react'

/**
 * Makes a Radix `Tooltip` tap-openable on touch devices (Radix only reacts to
 * hover/focus by default) while preserving desktop hover/focus behavior, and
 * closes it on any tap/click outside the trigger — otherwise a controlled
 * Tooltip has no built-in outside-dismiss layer (unlike Popover) and stays
 * open until the same tiny trigger is tapped again.
 *
 * Usage: `<Tooltip open={open} onOpenChange={setOpen}>` +
 * `<TooltipTrigger asChild><button ref={triggerRef} onClick={toggle}>`.
 */
export function useTapToggleTooltip<T extends HTMLElement = HTMLButtonElement>() {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<T>(null)

    useEffect(() => {
        if (!open) return
        const handlePointerDown = (e: PointerEvent) => {
            if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [open])

    const toggle = (e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        setOpen(o => !o)
    }

    return { open, setOpen, triggerRef, toggle }
}
