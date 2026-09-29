import type { Doc, Row, Json } from './pw1-export/contracts'
export function sanitizeProductDocument(document: Doc, sourceRow: Row, options: {sourceInstanceToken:string}):Doc
export function validateProductDocument(product:Doc, context?:{allowEmptyCategory?:boolean;tenantRef?:string;siteRefs?:Set<Json>;categoryRefs?:Set<Json>;mediaRefs?:Set<Json>}):{code:string;path:string;message:string}[]
export function findProductSkuCollisions(products:Doc[]):Map<string,{code:string;path:string;message:string}[]>
export function htmlToLexical(value: string | null | undefined): Doc | undefined
export function deriveVariantBaseSku(productRef:string,sourceInstanceToken:string):string
export function normalizeExternalMediaUrl(value: unknown): string | undefined
