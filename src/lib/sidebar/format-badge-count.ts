/**
 * Compact sidebar badge count using the international short scale (K/M/B/T) so large counts
 * never overflow the tiny pill. Shared by the dashboard sidebar and the editor menu drawer.
 *
 *   999 → "999" · 1000 → "1K" · 1500 → "1.5K" · 12_000 → "12K" · 1_000_000 → "1M" · 1e9 → "1B"
 *
 * Pinned to `en-US` so the abbreviation stays latin (K/M/B) regardless of the UI locale, and
 * capped at 1 fraction digit (Intl auto-drops a trailing ".0", e.g. 1000 → "1K" not "1.0K").
 */
const badgeFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
})

export function formatBadgeCount(value: number): string {
    // Defensive: a non-finite value (Infinity/NaN) would render "∞"/"NaN" in the pill.
    if (!Number.isFinite(value)) return '0'
    return badgeFormatter.format(value)
}
