// Minimal structural type: accepts both GeneratedBlock and AIBlock from route.ts.
// AIBlock has blockType?: string (optional), so we use the widened form here.
type BlockLike = { [key: string]: unknown }

// Fallback variants for media blocks whose required URL is missing.
// Keeps the layout family (split-video → two-column, video → full-bleed)
// while eliminating the empty-media placeholder from public renders.
const VIDEO_VARIANT_FALLBACK: Record<string, Record<string, string>> = {
    hero: { 'split-video': 'split-left', 'video': 'fullscreen' },
}

// Mutates blocks in-place: if a block has a video/media variant but no valid URL,
// coerce it to a safe non-media variant. Prevents "No video URL provided" leaking
// onto generated homepages (GH-1266).
export function coerceVideoVariants(blocks: BlockLike[]): void {
    for (const block of blocks) {
        if (typeof block.blockType !== 'string') continue
        const fallbacks = VIDEO_VARIANT_FALLBACK[block.blockType]
        if (!fallbacks || typeof block.variant !== 'string') continue
        const fallback = fallbacks[block.variant]
        if (!fallback) continue
        const url = block.videoUrl
        const hasUrl = typeof url === 'string' && url.trim() !== ''
        if (!hasUrl) {
            console.warn(
                `[generate-site] hero variant '${block.variant}' has no videoUrl — coercing to '${fallback}' (GH-1266)`
            )
            block.variant = fallback
        }
    }
}
