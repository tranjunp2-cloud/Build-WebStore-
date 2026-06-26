'use client'

import { useEffect } from 'react'

/**
 * Sets <html lang> to the storefront site's locale.
 *
 * The root layout renders a single, static `<html lang="en">` and App Router
 * has no per-segment way to change it server-side. This client component
 * corrects the attribute on the storefront (e.g. Bahasa Melayu sites) so the
 * page language signal matches the actual content. Renders nothing.
 */
export function HtmlLang({ locale }: { locale?: string | null }) {
    useEffect(() => {
        if (locale) document.documentElement.lang = locale
    }, [locale])
    return null
}
