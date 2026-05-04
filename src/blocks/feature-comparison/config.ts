import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── Feature Comparison Block ──
export type ComparisonProduct = { name: string; highlighted?: boolean }
export type ComparisonFeature = { name: string; values: boolean[] }
export type FeatureComparisonConfig = { blockType: 'feature-comparison'; variant?: 'table' | 'cards'; headline?: string; products: ComparisonProduct[]; features: ComparisonFeature[] }
export const FeatureComparisonConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('feature-comparison'), variant: z.enum(['table', 'cards']).default('table'), headline: z.string().optional(), products: z.array(z.object({ name: z.string(), highlighted: z.boolean().optional() })), features: z.array(z.object({ name: z.string(), values: z.array(z.boolean()) })) })
export const featureComparisonMeta = { type: 'feature-comparison' as const, name: 'Feature Comparison', description: 'Compare products or plans with feature matrix', icon: '⚖️', variants: ['table', 'cards'], defaultVariant: 'table', editableFields: ['headline', 'products', 'features'], quickActions: ['Add product', 'Add feature'], aiVisible: true }

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = FeatureComparisonConfigSchema
