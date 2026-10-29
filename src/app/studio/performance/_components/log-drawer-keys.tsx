'use client'
/** Escape closes the drawer; focus moves into it when it opens. Renders nothing. */
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function DrawerKeys({ closeHref, targetId }: { closeHref: string; targetId: string }) {
    const router = useRouter()
    useEffect(() => {
        document.getElementById(targetId)?.focus()
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push(closeHref, { scroll: false }) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [closeHref, router, targetId])
    return null
}
