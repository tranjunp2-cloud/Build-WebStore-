'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import './ai-limits.css'

interface Props {
    title: string
    onClose: () => void
    /** a request is running: Escape and the scrim do not close */
    busy?: boolean
    role?: 'dialog' | 'alertdialog'
    children: ReactNode
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/** Modal with a scrim: Escape / scrim close it (unless busy), focus starts inside and Tab stays inside. */
export function Dialog({ title, onClose, busy = false, role = 'dialog', children }: Props) {
    const titleId = useId()
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null
        const node = ref.current
        // prefer a field over the header; fall back to the dialog itself
        ;(node?.querySelector<HTMLElement>('input, textarea, [role="radio"]') ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus()
        return () => previous?.focus?.()
    }, [])
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); return }
            if (event.key !== 'Tab' || !ref.current) return
            const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
            if (items.length === 0) return
            const first = items[0]
            const last = items[items.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [busy, onClose])
    return (
        <>
            <div className="acl-scrim" onClick={busy ? undefined : onClose} />
            <div ref={ref} className="acl-dialog" role={role} aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
                <h2 id={titleId}>{title}</h2>
                {children}
            </div>
        </>
    )
}
