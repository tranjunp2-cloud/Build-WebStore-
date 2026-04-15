import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── Video Background Block ──
export type VideoBackgroundCTA = { label: string; url: string }
export type VideoBackgroundConfig = { blockType: 'video-background'; variant?: 'full' | 'contained'; headline?: string; subheadline?: string; videoUrl: string; posterImage?: string; overlayOpacity?: number; cta?: VideoBackgroundCTA }
export const VideoBackgroundConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('video-background'), variant: z.enum(['full', 'contained']).default('full'), headline: z.string().optional(), subheadline: z.string().optional(), videoUrl: z.string(), posterImage: z.string().optional(), overlayOpacity: z.number().min(0).max(100).default(50), cta: z.object({ label: z.string(), url: z.string() }).optional() })
export const videoBackgroundMeta = { type: 'video-background' as const, name: 'Video Background', description: 'Full-width video background with overlay text', icon: '🎬', variants: ['full', 'contained'], defaultVariant: 'full', editableFields: ['headline', 'subheadline', 'videoUrl', 'posterImage', 'overlayOpacity', 'cta'], quickActions: ['Change overlay', 'Edit CTA'], aiVisible: false }
