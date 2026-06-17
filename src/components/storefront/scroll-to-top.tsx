'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** Resets viewport scroll to top on each navigation. Uses 'instant' to avoid fighting SiteLayoutShell's scroll-behavior:smooth CSS.
 *  Depends on pathname so it re-fires when App Router reuses this component instance across dynamic segment navigations. */
export function ScrollToTop() {
    const pathname = usePathname()
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }, [pathname])
    return null
}
