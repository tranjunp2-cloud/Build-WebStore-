/**
 * Active-route matcher shared by both sidebars — exact match OR a nested child route (`href + '/'`).
 * Mirrors the inline check previously duplicated in the dashboard sidebar and the editor drawer.
 */
export function isPathActive(pathname: string | null | undefined, href: string): boolean {
    return pathname === href || (pathname?.startsWith(href + '/') ?? false)
}
