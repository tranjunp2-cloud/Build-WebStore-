import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── Countdown Timer Block ──
export type CountdownTimerConfig = { blockType: 'countdown-timer'; variant?: 'banner' | 'card' | 'minimal'; headline: string; targetDate: string; expiredMessage?: string; showDays?: boolean; showHours?: boolean; showMinutes?: boolean; showSeconds?: boolean }
export const CountdownTimerConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('countdown-timer'), variant: z.enum(['banner', 'card', 'minimal']).default('banner'), headline: z.string(), targetDate: z.string(), expiredMessage: z.string().optional(), showDays: z.boolean().default(true), showHours: z.boolean().default(true), showMinutes: z.boolean().default(true), showSeconds: z.boolean().default(true) })
export const countdownTimerMeta = { type: 'countdown-timer' as const, name: 'Countdown Timer', description: 'Live countdown to a target date', icon: '⏳', variants: ['banner', 'card', 'minimal'], defaultVariant: 'banner', editableFields: ['headline', 'targetDate', 'expiredMessage', 'showDays', 'showHours', 'showMinutes', 'showSeconds'], quickActions: ['Change date', 'Toggle units'] }
