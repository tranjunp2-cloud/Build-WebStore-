import type { SiteType } from '../../ai/site-type'
export type Row = Record<string, string | null>
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json }
export type Doc = { [key: string]: Json }
export const ROOTS = [
  'tenants',
  'users',
  'sites',
  'pages',
  'media',
  'categories',
  'products',
  'customers',
  'discounts',
  'orders',
  'discount_usage_history',
  'blog_categories',
  'blogs',
  'email-template-settings',
  'plan-subscriptions',
  'plan-subscription-usages',
  'notifications',
  'subscribers',
  'contact-submissions',
  'analytics',
] as const
export type Collection = (typeof ROOTS)[number]
export type StoreOutput = Record<Collection, Doc[]>
export interface MigrationPolicy {
  decisionEvidence: string
  preserveHistoricalOrders?: boolean
  promoteActiveCategoriesToRoot?: boolean
  deferredStoreIds?: string[]
  activeCatalogOnly: boolean
  deferEmailTemplates: boolean
  allowSparseVariants: boolean
  preserveUserCreators: boolean
  siteTypeDefault: 'ecommerce'
  siteTypeOverrides: Record<string, SiteType>
  shippingPolicy: 'pw2-defaults' | 'review'
}
export interface SourceConfig {
  migrationPolicy?: MigrationPolicy
  acceptedExclusions?: {
    ruleId: 'MASTER-2.2-OPTIONAL-HISTORY'
    collection:
      | 'notifications'
      | 'subscribers'
      | 'contact-submissions'
      | 'analytics'
    reason: string
    decisionEvidence: string
  }[]
  readOnlyUserIds?: string[]
  version: 1
  sourceInstance: string
  sourceDatabase: string
  sourceInstanceToken: string
  snapshotId: string
  asOf: string
  utcOffset: string
  timezone?: string
  sourcePlatformSuffix: string
  targetPlatformSuffix: string
  tables: Record<string, string>
  nullTokens: string[]
  deletedStores: 'exclude' | 'review'
  maxInputBytes: number
  maxRecordBytes: number
  maxRows: number
  maxResidentBytes: number
}
export interface Diagnostic {
  code: string
  severity: 'warning' | 'blocker'
  storeId?: string
  table?: string
  sourceId?: string
  field?: string
  /** Fixed machine reason only; never source values or exception messages. */
  reason?: string
}
export interface Contribution {
  storeId?: string
  table: string
  sourceId: string
  fields: string[]
  targetPath: string
  rule: string
}
export interface MappingContext {
  /** Offline identity evidence only; never credentials or arbitrary archive values. */
  captureCustomerReconciliation?: (diagnostics: unknown) => void
  config: SourceConfig
  tables: Readonly<Record<string, Row[]>>
  storeId: string
  output: StoreOutput
  diagnostics: Diagnostic[]
  contributions: Contribution[]
  rows(table: string, includeDeleted?: boolean): Row[]
  find(table: string, id: string | null | undefined): Row | undefined
  issue(
    code: string,
    table?: string,
    sourceId?: string | null,
    field?: string,
    severity?: 'warning' | 'blocker',
    reason?: string,
  ): void
  contribute(
    table: string,
    row: Row,
    fields: string[],
    targetPath: string,
    rule: string,
  ): void
}
export const ref = (collection: string, table: string, id: string) =>
  `@${collection}:${table}:${id}`
export const live = (row: Row) => !row.deleted_at
export const value = (row: Row, key: string) => row[key] ?? ''
export function emptyStore(): StoreOutput {
  return Object.fromEntries(
    ROOTS.map((key) => [key, []]),
  ) as unknown as StoreOutput
}
