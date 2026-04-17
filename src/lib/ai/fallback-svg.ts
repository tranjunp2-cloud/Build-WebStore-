/**
 * Inline SVG data-URL placeholders — replaces external `placehold.co` HTTP
 * calls in composer output. Composer emits these as initial block values;
 * media-injector overwrites with real Unsplash URLs when pool has coverage.
 * If pool miss → SVG sticks (graceful, no external request, no gray broken
 * image box).
 *
 * Plan: plans/260417-0817-wave1-wix-detailed-plan/phase-04-C2-image-pool-coverage.md
 */

function svg(width: number, height: number, fill: string, text: string): string {
  const body = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect fill="${fill}" width="${width}" height="${height}"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" fill="#9ca3af" font-family="system-ui,sans-serif" font-size="14">${text}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(body)}`
}

/** Neutral light gray placeholder — generic 3:2 landscape. */
export const NEUTRAL_FALLBACK_SVG = svg(600, 400, '#f3f4f6', 'Image')

/** Portrait-oriented placeholder — for product cards. */
export const PORTRAIT_FALLBACK_SVG = svg(400, 500, '#f3f4f6', 'Product')

/** Square placeholder — for team/doctor avatars. */
export const AVATAR_FALLBACK_SVG = svg(400, 400, '#e5e7eb', 'Photo')

/** Wide-format placeholder — for logo cloud. */
export const LOGO_FALLBACK_SVG = svg(200, 80, '#f9fafb', 'Logo')
