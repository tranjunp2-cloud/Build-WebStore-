import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type WhatsappButtonConfig = { blockType: 'whatsapp-button'; variant?: 'floating'; phoneNumber: string; countryCode?: string; message?: string; label?: string; position?: 'bottom-right' | 'bottom-left' }
export const WhatsappButtonConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('whatsapp-button'), variant: z.enum(['floating']).default('floating'),
    phoneNumber: z.string(), countryCode: z.string().default('+60'), message: z.string().optional(), label: z.string().default('Chat with us'),
    position: z.enum(['bottom-right', 'bottom-left']).default('bottom-right'),
})
export const whatsappButtonMeta = { type: 'whatsapp-button' as const, name: 'Whatsapp', description: 'Floating WhatsApp contact button', icon: '💬', variants: ['floating'], defaultVariant: 'floating', editableFields: ['phoneNumber', 'countryCode', 'message', 'label', 'position'], quickActions: ['Change position', 'Edit message'], aiVisible: true, category: 'form' as const, scope: 'global' as const, scopeTooltip: 'Nút chat hỗ trợ sẽ tự động hiển thị cố định trên tất cả các trang của website sau khi bạn thêm vào.' }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = WhatsappButtonConfigSchema
