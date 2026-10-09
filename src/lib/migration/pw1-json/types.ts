export const COLLECTIONS = ['tenants', 'users', 'sites', 'pages', 'media', 'categories', 'products', 'customers', 'discounts', 'orders', 'discount_usage_history', 'blog_categories', 'blogs', 'email-template-settings', 'plan-subscriptions', 'plan-subscription-usages', 'notifications', 'subscribers', 'contact-submissions', 'analytics'] as const
export type CollectionName = typeof COLLECTIONS[number]
export type ImportDocument = Record<string, unknown>
export interface ImportStore { storeId: string; collections: Record<CollectionName, ImportDocument[]> }
export interface ImportDiagnostic { code: string; severity: 'warning' | 'blocker'; storeId?: string; table?: string; sourceId?: string; field?: string; reason?: string; count?: number }
export interface ImportManifest {
  version: 1 | 2 | 3
  profile: 'pw1-json-v1' | 'pw1-json-v2' | 'pw1-json-v3'
  sourceInstanceToken?: string
  migrationPolicyHash?: string | null
  actorArtifactHash?: string | null
  creatorBindingsHash?: string | null
  classifierVersion?: 'diagnostic-policy-v1' | 'diagnostic-policy-v2'
  classificationVersion?: 'source-classification-v1'
  customerReconciliationHash?: string
  productReconciliationHash?: string
  sourceInstance: string
  sourceDatabase: string
  snapshotId: string
  asOf: string
  mappingHash: string
  masterHash: string
  credentialHash: string | null
  exporterManifestHash: string
}
export interface ArtifactCoverage {
  sourceStoreCount: number
  selectedStoreCount: number
  policyExcludedStoreCount: number
  emittedStoreCount: number
  blockedStoreCount: number
  blockers: number
}
export interface ImportArtifact {
  masterParts?: import('./master-parts').MasterPart[]
  delegateRawPageContent?: boolean
  delegateRawModelSettings?: boolean
  preserveInvalidUserEmails?: boolean
  coverage: ArtifactCoverage
  pageExcludedRecords: number
  optionalDispositions: Record<string, 'ACCEPTED_SOURCE_EXCLUSION' | 'SOURCE_UNVERIFIED'>
  manifest: ImportManifest
  manifestPath: string
  manifestHash: string
  directory: string
  stores: ImportStore[]
  spoolDirectory?: string
  targetCheckFiles?: Record<string, { path: string; hash: string }>
  storeFiles?: Record<string, { path: string; hash: string }>
  storeIds: string[]
  diagnosticSummary?: import('./diagnostics').DiagnosticSummary
  actors?: import('./creator-bindings').UserActors
  creatorBindings?: import('./creator-bindings').CreatorBindings
  diagnostics: ImportDiagnostic[]
  blockers: ImportDiagnostic[]
}
export interface SourceCredential { key_string: string | null; passwordHash?: string }
export type StoreSelector = { store?: string; stores?: string; fromStore?: string; toStore?: string; all?: boolean }
