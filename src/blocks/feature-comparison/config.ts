import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── Feature Comparison Block ──
export type ComparisonProduct = { name: string; highlighted?: boolean }
export type ComparisonFeature = { name: string; values: boolean[] }
export type FeatureComparisonConfig = { blockType: 'feature-comparison'; variant?: 'table' | 'cards'; headline?: string; products: ComparisonProduct[]; features: ComparisonFeature[] }

const FALSE_COMPARISON_VALUES = new Set([
    '',
    '0',
    'false',
    'no',
    'none',
    'not included',
    'unavailable',
    'n/a',
    'na',
    'add-on',
    'addon',
    'optional',
    'tidak',
    'tidak termasuk',
    'tidak tersedia',
    'không',
    'khong',
    'không có',
    'khong co',
])

export function normalizeComparisonValue(value: unknown): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value !== 'string') return false
    return !FALSE_COMPARISON_VALUES.has(value.trim().toLocaleLowerCase())
}

export function normalizeComparisonValues(values: unknown, productCount: number): boolean[] {
    const source = Array.isArray(values) ? values : []
    return Array.from(
        { length: Math.max(0, productCount) },
        (_, index) => normalizeComparisonValue(source[index]),
    )
}

export const FeatureComparisonConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('feature-comparison'), variant: z.enum(['table', 'cards']).default('table'), headline: z.string().optional(), products: z.array(z.object({ name: z.string(), highlighted: z.boolean().optional() })), features: z.array(z.object({ name: z.string(), values: z.array(z.boolean()) })) })
export const featureComparisonMeta = { type: 'feature-comparison' as const, name: 'Feature Comparison', description: 'Compare products or plans with feature matrix', icon: '⚖️', variants: ['table', 'cards'], defaultVariant: 'table', editableFields: ['headline', 'products', 'features'], quickActions: ['Add product', 'Add feature'], aiVisible: true, category: 'store' as const }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = FeatureComparisonConfigSchema
