import { z } from 'zod'

export const BrandEvidenceSchema = z.object({
    carouselFrames: z.array(z.object({ imageUrl: z.string(), aspectRatio: z.number().min(0.2).max(10), imageFit: z.enum(['cover','contain','scale-down']), slidesPerView: z.number().int().min(1).max(6) })).optional(),
    status: z.enum(['observed', 'unavailable']),
    url: z.string(), capturedAt: z.string(),
    colors: z.array(z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i), score: z.number(), roles: z.array(z.string()) })),
    transport: z.enum(['https', 'https-relaxed', 'http']).optional(),
    logoScreenshot: z.string().optional(), logoUrl: z.string().optional(),
    palette: z.object({ primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), reason: z.string(), confidence: z.enum(['low','medium','high']) }).optional(),
    analysisTokens: z.number().optional(), analysisModel: z.string().optional(),
    screenshot: z.string().optional(), warning: z.string().optional(),
})
export type BrandEvidence = z.infer<typeof BrandEvidenceSchema>
export function rankBrandColors(samples: Array<{ color: string; role: string }>, includeNeutral = false) {
    const colors = new Map<string, { color: string; score: number; roles: string[] }>()
    for (const sample of samples) {
        const match = sample.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/)
        if (!match || (match[4] !== undefined && Number(match[4]) < 0.8)) continue
        const rgb = match.slice(1, 4).map(Number)
        if (rgb.some(v => v > 255) || (!includeNeutral && Math.max(...rgb) - Math.min(...rgb) < 25)) continue
        const color = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
        const entry = colors.get(color) ?? { color, score: 0, roles: [] }
        entry.score += sample.role === 'cta' ? 5 : sample.role === 'navigation' ? 3 : 1
        if (!entry.roles.includes(sample.role)) entry.roles.push(sample.role)
        colors.set(color, entry)
    }
    return [...colors.values()].sort((a, b) => b.score - a.score || a.color.localeCompare(b.color)).slice(0, 8)
}
