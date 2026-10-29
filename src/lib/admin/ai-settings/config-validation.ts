/**
 * Validation of the platform AI config as edited on the page: the same schema the collection hook and
 * ai-platform use, plus "every chain model has a price" (the editor only offers priced models).
 */
import { AiPlatformConfigSchema, type AiPlatformConfig } from '@/lib/ai-platform/ai-config-schema'
import type { FieldError } from './types'

export const CHAIN_KEYS = ['fast', 'balanced', 'quality', 'image'] as const

export function parseChain(chain: string | undefined): string[] {
  return (chain ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

export function joinChain(models: readonly string[]): string {
  return models.join(', ')
}

export function validateConfig(input: unknown): { config: AiPlatformConfig } | { errors: FieldError[] } {
  const parsed = AiPlatformConfigSchema.safeParse(input)
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => ({
        path: ['config', ...issue.path.map(String)],
        message: issue.message,
      })),
    }
  }
  const config = parsed.data
  const errors: FieldError[] = []
  for (const key of CHAIN_KEYS) {
    const known = key === 'image' ? config.images : config.prices
    for (const model of parseChain(config.models[key])) {
      if (!(model in known)) {
        errors.push({ path: ['config', 'models', key], message: `${model} has no ${key === 'image' ? 'picture ' : ''}price below. Add it first.` })
      }
    }
  }
  return errors.length ? { errors } : { config }
}
