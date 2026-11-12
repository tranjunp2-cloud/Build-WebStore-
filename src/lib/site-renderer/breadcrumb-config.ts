// Single source of truth for "is the global breadcrumb on?" — shared by the live renderer
// (SiteRenderer) and the Editor toggle (SettingsPanel) so the two can never disagree (GH-2246).

export interface BreadcrumbConfig {
    homeLabel?: string
    separator?: string
    showOnAllPages?: boolean | null
}

/**
 * Breadcrumb is only rendered when the merchant/AI has a saved config.
 * - No config (old stores) → off: published sites must not get breadcrumb auto-enabled.
 * - Config without `showOnAllPages` → on (legacy data saved before the flag existed).
 * - `false` / `null` → off (Payload may store unset booleans as null).
 */
export function isBreadcrumbEnabled(cfg: BreadcrumbConfig | null | undefined): boolean {
    if (cfg === undefined || cfg === null) return false
    return cfg.showOnAllPages !== false && cfg.showOnAllPages !== null
}

/**
 * Merge editor changes into the saved config, always persisting the current on/off state
 * explicitly so editing another field (e.g. Home label) never flips the toggle implicitly.
 */
export function buildBreadcrumbConfig(
    cfg: BreadcrumbConfig | null | undefined,
    changes: BreadcrumbConfig,
): BreadcrumbConfig {
    return { ...cfg, showOnAllPages: isBreadcrumbEnabled(cfg), ...changes }
}
