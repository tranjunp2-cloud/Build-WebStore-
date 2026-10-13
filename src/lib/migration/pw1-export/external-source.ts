import { RAW_FIELDS } from './mappers/raw-fields'

export const EXTERNAL_SOURCE_RULE = 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE'
const tables = new Set(['stores', 'frontend_templates', 'model_settings', 'brands', 'categories', 'products', 'blog_categories', 'blog_posts', 'store_domains', 'attributes', 'attribute_values', 'category_attributes'])
export function externalSourceField(table: string, field: string): boolean {
  return tables.has(table) && (RAW_FIELDS[table]?.includes(field) ?? false) &&
    !/password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key|cookie/i.test(field)
}
export function externalSourcePath(table: string): string { return `source-csv.${table}` }
