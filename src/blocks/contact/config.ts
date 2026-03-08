import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type FormField = { label: string; fieldName: string; fieldType?: string; placeholder?: string; required?: boolean }
export type ContactConfig = { blockType: 'contact'; variant?: 'form' | 'info-only' | 'split'; headline?: string; subtext?: string; email?: string; phone?: string; address?: string; formFields: FormField[] }
export const ContactConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('contact'), variant: z.enum(['form', 'info-only', 'split']).default('form'),
    headline: z.string().optional(), subtext: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), address: z.string().optional(),
    formFields: z.array(z.object({ label: z.string(), fieldName: z.string(), fieldType: z.string().default('text'), placeholder: z.string().optional(), required: z.boolean().default(false) })).default([]),
})
export const contactMeta = { type: 'contact' as const, name: 'Contact', description: 'Contact form and business info', icon: '📬', variants: ['form', 'info-only', 'split'], defaultVariant: 'form', editableFields: ['headline', 'email', 'phone', 'address', 'formFields'], quickActions: ['Add field', 'Change layout'] }
