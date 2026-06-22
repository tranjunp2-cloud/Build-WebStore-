import { z } from 'zod'

export const analyticsTrackSchema = z.object({
    siteId: z.coerce.string().min(1),
    event: z.string().optional(),
    pageUrl: z.string().min(1),
    referrer: z.string().optional(),
    sessionId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
})
