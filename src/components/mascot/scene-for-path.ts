import type { SceneName } from '@/mascot'

// First match wins: the robot holds the page's own thing (a box on products, a truck on orders...)
const SCENE_BY_PREFIX: Array<[string, SceneName]> = [
    ['/products', 'products'],
    ['/orders', 'orders'],
    ['/customers', 'customers'],
    ['/contact-leads', 'customers'],
    ['/settings/staff', 'customers'],
    ['/discounts', 'marketing'],
    ['/blog', 'marketing'],
    ['/templates-health', 'analytics'],
    ['/settings', 'settings'],
    ['/help', 'support'],
]

/** The empty-state scene for a dashboard route; `empty` when the route has no scene of its own. */
export function emptySceneForPath(pathname: string | null | undefined): SceneName {
    const path = pathname ?? ''
    const hit = SCENE_BY_PREFIX.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
    return hit ? hit[1] : 'empty'
}
