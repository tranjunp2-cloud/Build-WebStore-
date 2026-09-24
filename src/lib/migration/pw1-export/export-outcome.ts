import { PAGE_MENU_SCOPE_CODE, TECHNICAL_SCOPE_CODE } from './approved-source-scope'
import { MODEL_SETTINGS_RETAIN_CODE, MODEL_SETTINGS_SCOPE_CODE } from './model-settings-scope'
import { sourceExclusionDiagnostic } from './source-exclusions'
import { isProductExclusionDiagnostic } from './product-exclusions'
import { z } from 'zod'
type Diagnostic = { code: string; severity: 'warning' | 'blocker'; storeId?: string; table?: string; sourceId?: string; field?: string; reason?: string }

export type ReviewCategory = 'data_issue' | 'import_requirement' | 'delegated_content' | 'outside_scope' | 'policy_excluded' | 'warning'
const categories: ReviewCategory[] = ['data_issue', 'import_requirement', 'delegated_content', 'outside_scope', 'policy_excluded', 'warning']
const fidelity = new Set(['PRODUCT_DESCRIPTION_STYLE_FIDELITY', 'PRODUCT_DESCRIPTION_CONTENT_FIDELITY', 'PRODUCT_DESCRIPTION_ATTRIBUTE_FIDELITY', 'BLOG_STYLE_FIDELITY', 'BLOG_CONTENT_FIDELITY'])
const pages = new Set(['pages', 'page_components', 'banners', 'shortlist_items', 'frontend_components'])
const rawCodes = new Set(['RAW_FIELD_UNVERIFIED', 'RAW_VALUE_UNVERIFIED', 'RAW_COMPONENT_DEFINITION_MISSING', 'SOURCE_FIELDS_UNRESOLVED'])
/** Handoff classification does not erase source diagnostics or certify target readiness. */
type ArchiveRow = { table: string; sourceId: string; storeId: string | null; ownership?: { rule: string }; contributions: { storeId?: string; table: string; sourceId: string; rule: string; targetPath: string }[] }
const archiveTables = new Set(['model_settings', 'frontend_templates', 'brands', 'attributes', 'attribute_values', 'category_attributes'])
export const archiveKey = (storeId: string, table: string, sourceId: string) => JSON.stringify([storeId, table, sourceId])
export function externalArchiveKeys(row: ArchiveRow, selected?: ReadonlySet<string>): string[] {
  if (!archiveTables.has(row.table) || !row.ownership || row.ownership.rule.startsWith('OWNERSHIP_') || !row.contributions.length ||
    row.contributions.some(c => c.table !== row.table || c.sourceId !== row.sourceId || c.rule !== 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE' || c.targetPath !== `source-csv.${row.table}` || (row.storeId !== null && c.storeId !== row.storeId))) return []
  return row.contributions.flatMap(c => c.storeId && (!selected || selected.has(c.storeId)) ? [archiveKey(c.storeId, row.table, row.sourceId)] : [])
}
export function approvedReviewScope(diagnostics: readonly Diagnostic[]): ReadonlySet<string> { return new Set(diagnostics.filter(d => [MODEL_SETTINGS_RETAIN_CODE, PAGE_MENU_SCOPE_CODE, TECHNICAL_SCOPE_CODE].includes(d.code) && d.severity === 'warning' && d.table && d.storeId === undefined && d.sourceId === undefined && d.field === undefined && d.reason === undefined).map(d => d.table!)) }
export function reviewCategory(d: Diagnostic, archive: ReadonlySet<string> = new Set(), excluded: ReadonlySet<string> = new Set(), approvedScope: ReadonlySet<string> = new Set()): ReviewCategory {
  if (d.severity === 'warning' && ((approvedScope.has(d.table ?? '') && ['SOURCE_OWNERSHIP_UNRESOLVED','RAW_OWNERSHIP_MISMATCH','RAW_COMPONENT_DEFINITION_MISSING','RAW_MENU_TYPE_MISSING','RAW_SECRET_EXCLUDED'].includes(d.code)) || (d.code === 'RAW_TEMPLATE_MISSING' && d.table === 'stores' && approvedScope.has('frontend_templates')))) return 'outside_scope'
  if ([MODEL_SETTINGS_RETAIN_CODE,TECHNICAL_SCOPE_CODE,PAGE_MENU_SCOPE_CODE].includes(d.code) && d.severity === 'warning') return 'outside_scope'
  if (d.table === 'model_settings' && d.severity === 'warning' && d.code === MODEL_SETTINGS_SCOPE_CODE) return 'outside_scope'
  if (sourceExclusionDiagnostic(d)) return 'policy_excluded'
  if (isProductExclusionDiagnostic(d)) return 'policy_excluded'
  if (d.storeId && excluded.has(d.storeId)) return 'policy_excluded'
  if (d.severity === 'warning' && d.storeId && d.sourceId && (
    (d.code === 'ORDER_PAYMENT_METHOD_UNVERIFIED' && d.table === 'orders' && d.field === 'payment_method_id' && !d.reason) ||
    (d.code === 'SUBSCRIPTION_CANCEL_FLAG_ABSENT' && d.table === 'plan_subscriptions' && d.field === 'canceled_immediately' && d.reason === 'NO_CANCELLATION_DATE')
  )) return 'import_requirement'
  if (d.severity !== 'blocker') return 'warning'
  if (d.storeId && !d.reason && (
    (d.code === 'TARGET_USER_CREATOR_BINDING_REQUIRED' && d.table === 'users' && d.field === 'created_by') ||
    (d.code === 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP' && d.table === 'products' && d.field === 'slug') ||
    (d.code === 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED' && ['blogs', 'blog_posts', 'blog_categories'].includes(d.table ?? '') && d.field === 'slug')
  )) return 'import_requirement'
  if (d.sourceId && !d.reason && fidelity.has(d.code) && (
    (d.table === 'products' && ['description', 'description_ms'].includes(d.field ?? '') && d.code.startsWith('PRODUCT_DESCRIPTION_')) ||
    (d.table === 'blog_posts' && d.field === 'content' && d.code.startsWith('BLOG_'))
  )) return 'delegated_content'
  if (pages.has(d.table ?? '') && rawCodes.has(d.code)) return 'outside_scope'
  if (d.storeId && d.table && d.sourceId && ['RAW_VALUE_UNVERIFIED', 'RAW_FIELD_UNVERIFIED'].includes(d.code) && archive.has(archiveKey(d.storeId, d.table, d.sourceId))) return 'outside_scope'
  // Unknown codes, source ownership, unsafe links and missing media remain visible data issues.
  return 'data_issue'
}
const count = z.number().int().nonnegative()
export const outcomeSchema = z.object({
  exportStatus: z.literal('succeeded'), dataStatus: z.enum(['complete', 'partial']),
  importStatus: z.literal('not_verified'),
  dataIssueCount: count, importRequirementCount: count, delegatedContentCount: count,
  outsideScopeCount: count, policyExcludedDiagnosticCount: count, warningCount: count, blockedStoreCount: count, policyExcludedStoreCount: count,
}).strict()
export type ExportOutcome = z.infer<typeof outcomeSchema>
export function exportOutcome(diagnostics: readonly Diagnostic[], blockedStoreCount: number, policyExcludedStores: readonly string[], archive: ReadonlySet<string> = new Set()): ExportOutcome {
  const excluded = new Set(policyExcludedStores)
  const counts = Object.fromEntries(categories.map(category => [category, 0])) as Record<ReviewCategory, number>
  const scope = approvedReviewScope(diagnostics)
  for (const d of diagnostics) counts[reviewCategory(d, archive, excluded, scope)]++
  return { exportStatus: 'succeeded', dataStatus: counts.data_issue || blockedStoreCount ? 'partial' : 'complete',
    importStatus: 'not_verified', dataIssueCount: counts.data_issue, importRequirementCount: counts.import_requirement,
    delegatedContentCount: counts.delegated_content, outsideScopeCount: counts.outside_scope, policyExcludedDiagnosticCount: counts.policy_excluded, warningCount: counts.warning,
    blockedStoreCount, policyExcludedStoreCount: excluded.size }
}
const actions: Record<ReviewCategory, string> = {
  data_issue: 'Sửa mapping/đối soát record nguồn; không tự loại dữ liệu để làm sạch trạng thái.',
  import_requirement: 'Importer kiểm tra DB đích: binding creator hoặc unique index theo tenant.',
  delegated_content: 'Giữ nội dung đã xuất; phần rich text xử lý riêng theo quyết định đã duyệt. Không bỏ kiểm tra URL/an toàn.',
  outside_scope: 'Pages ngoài phạm vi hoặc raw chỉ giữ tại CSV có bằng chứng không đóng góp vào target; giữ diagnostics đối soát.',
  policy_excluded: 'Store đã được hoãn theo policy: giữ bằng chứng đối soát, không tính vào phần dữ liệu đang migrate.',
  warning: 'Thông tin hoặc policy đã áp dụng; không chặn export.',
}
const guidance: Record<string, string> = {
  PRODUCT_CATALOG_POLICY_EXCLUDED: 'Product trùng slug hoặc không có biến thể hợp lệ đã bỏ theo policy; xem conflict-details để biết Product ID, slug và canonicalProductId. Không chặn Store vì Product đã loại.',
  PRODUCT_MISSING_PRICE_STOCK_EXCLUDED: 'Product thiếu giá/stock đã được bỏ theo policy; xem sourceId và reason. Các dòng con chỉ giữ trong CSV có bằng chứng; không tự chặn Store vì Product này.',
  ORDER_PAYMENT_METHOD_UNVERIFIED: 'Importer phải kiểm tra paymentMethod chưa xác định và các giá trị payment được phép; không tự suy ra COD.',
  SUBSCRIPTION_CANCEL_FLAG_ABSENT: 'Importer phải kiểm tra không có ngày hủy và không tự tạo canceledImmediately khi nguồn không có bằng chứng.',
  TARGET_USER_CREATOR_BINDING_REQUIRED: 'Importer bind creator hệ thống sso-service@primeweb.app với User ID đã xác minh; resolve users.createdBy. Không yêu cầu quyết định lại.',
  TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP: 'Kiểm tra unique index Product theo tenant trên DB đích; không tự đổi slug giữa các Store.',
  TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED: 'Kiểm tra unique index Blog/category theo tenant trên DB đích; khác với trùng slug trong cùng Store.',
  BLOG_SLUG_COLLISION: 'Đối chiếu các Blog/category trùng slug trong cùng Store và chọn quy tắc giữ/đổi; không tự gộp record.',
  CATEGORY_INVALID: 'Đối chiếu category trùng slug trong Store hoặc trùng tên cùng cấp theo reason; chưa tự đổi tên/gộp.',
  SOURCE_NO_ELIGIBLE_SKU: 'Product thường không bắt buộc mã SKU. Còn thiếu dòng nguồn giá/stock đủ điều kiện trong product_skus; xác minh giá trước khi xuất, không tự đặt giá 0.',
  SOURCE_SELECTED_OPTION_INVALID: 'Sửa mapping hoặc đối soát option SKU không thuộc tập option của Product. Khác với thiếu tổ hợp được phép.',
  SOURCE_SELECTED_TIER_COUNT: 'Đối soát số tầng biến thể của SKU với cấu hình Product; không tự dựng thêm tổ hợp.',
  SOURCE_DUPLICATE_VARIANT_TUPLE: 'Đối soát nhiều SKU cùng tổ hợp option; cần chọn record đúng, không tự cộng/gộp giá và stock.',
  SOURCE_VARIANT_DOMAIN_MISSING: 'Thiếu định nghĩa thuộc tính/option để map biến thể; kiểm tra quan hệ nguồn.',
  PRODUCT_SKU_COLLISION: 'Đối soát mã SKU trùng trong phạm vi đích; không tự đổi mã SKU.',
  SOURCE_SKU_STOCK_INVALID: 'Đối soát stock nguồn không hợp lệ; không dùng mặc định 100 hoặc 0.',
  SOURCE_FIELDS_UNRESOLVED: 'Classifier chưa phân loại hết field ở table/Store này. Xem rows[].fields trong mapping-report.json; đây là việc mapping kỹ thuật, không phải yêu cầu review toàn bộ JSON.',
  SOURCE_OWNERSHIP_UNRESOLVED: 'Thiếu hoặc sai quan hệ parent để xác định Store nguồn; kiểm tra parent và phạm vi Pages/creator trước khi quyết định.',
  RAW_VALUE_UNVERIFIED: 'Giá trị nguồn chưa qua kiểm tra cấu trúc/URL. Xem field và reason; chỉ bỏ chặn raw có bằng chứng CSV-only, không bỏ kiểm tra nội dung vận hành.',
  PRODUCT_DESCRIPTION_LINK_UNSAFE: 'Phần xử lý nội dung cần kiểm tra URL/link trước khi ghi hoặc hiển thị; quyết định giữ mô tả không tự bỏ kiểm tra an toàn.',
  BLOG_LINK_UNSAFE: 'Kiểm tra link Blog trong bước xử lý nội dung; không chuyển thành cảnh báo hình thức.',
  PRODUCT_DESCRIPTION_MEDIA_UNRESOLVED: 'Đối soát media trong mô tả Product chưa resolve; kiểm tra dữ liệu bị thiếu trước khi import.',
  BLOG_MEDIA_UNRESOLVED: 'Đối soát media Blog chưa resolve; giữ dấu vết record bị ảnh hưởng.',
  CATEGORY_REFERENCE_UNRESOLVED: 'Product tham chiếu category chưa được xuất. Xử lý category gốc bị chặn trước, không tự chuyển Product sang category khác.',
  CATEGORY_PARENT_QUARANTINED: 'Category cha đang bị chặn; xử lý lỗi cha trước khi khôi phục category con.',
  BLOG_CATEGORY_UNRESOLVED: 'Blog tham chiếu category chưa được xuất; đối soát category trùng/không hợp lệ trước.',
  TENANT_LIFECYCLE_CONFLICT: 'Store chưa xuất do trạng thái Store/owner/subscription mâu thuẫn. Đối soát snapshot và quy tắc lifecycle, không tự kích hoạt lại.',
  USER_LIFECYCLE_CONFLICT: 'Store chưa xuất do lifecycle owner không hợp lệ; đối soát trạng thái/ngày nguồn.',
  OWNER_IDENTITY_CONFLICT: 'Chưa xác định được owner hợp lệ duy nhất; đối soát quan hệ và role nguồn.',
  SUBSCRIPTION_FUTURE_START: 'Ngày bắt đầu subscription sau mốc asOf; xác minh thời điểm snapshot, không tự sửa ngày.',
  ORDER_STATUS_UNVERIFIED: 'Trạng thái Order chưa có mapping đã xác minh; tiếp tục đối soát, không tự ép completed/cancelled.',
  ORDER_REFUND_EVIDENCE_REQUIRED: 'Thiếu bằng chứng refund để ánh xạ đúng Order; đối soát record refund/payment nguồn.',
  PAYMENT_PROVIDER_NOT_ACTIVATED: 'Importer kiểm tra payment flags đích trước khi loại khỏi phạm vi; không tự bật gateway hoặc lấy credential nguồn.',
  BLOG_AUTHOR_UNRESOLVED: 'Không resolve được tác giả Blog. Kiểm tra yêu cầu author của schema riêng với quyết định chỉ giữ lịch sử creator ở Users.',
  CUSTOMER_ADDRESS_OVERFLOW: 'Số địa chỉ vượt giới hạn đích; đối soát danh sách retained/quarantined trong customer-reconciliation.json.',
}
export function exportReview(diagnostics: readonly Diagnostic[], blocked: string[], excluded: string[], archive: ReadonlySet<string> = new Set()) {
  const excludedIds = new Set(excluded)
  const scope = approvedReviewScope(diagnostics)
  const groups = new Map<string, { category: ReviewCategory; code: string; table?: string; field?: string; reason?: string; count: number; stores: Set<string>; examples: { storeId?: string; sourceId?: string }[] }>()
  for (const d of diagnostics) {
    const category = reviewCategory(d, archive, excludedIds, scope), key = JSON.stringify([category, d.code, d.table, d.field, d.reason])
    let group = groups.get(key)
    if (!group) { group = { category, code: d.code, ...(d.table ? { table: d.table } : {}), ...(d.field ? { field: d.field } : {}), ...(d.reason ? { reason: d.reason } : {}), count: 0, stores: new Set(), examples: [] }; groups.set(key, group) }
    group.count++; if (d.storeId) group.stores.add(d.storeId)
    if (group.examples.length < 5) group.examples.push({ ...(d.storeId ? { storeId: d.storeId } : {}), ...(d.sourceId ? { sourceId: d.sourceId } : {}) })
  }
  return { version: 1, ...exportOutcome(diagnostics, blocked.length, excluded, archive), blockedStores: blocked, policyExcludedStores: excluded,
    groups: [...groups.values()].sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category) || b.count - a.count || a.code.localeCompare(b.code)).map(({ stores, ...group }) => ({ ...group, affectedStores: stores.size, action: (['PRODUCT_MISSING_PRICE_STOCK_EXCLUDED', 'PRODUCT_CATALOG_POLICY_EXCLUDED'].includes(group.code) || group.category === 'data_issue' || group.category === 'import_requirement') ? guidance[group.code] ?? actions[group.category] : group.category === 'outside_scope' && scope.size ? 'Nội dung Page/Menu được giữ nguyên trong artifact raw; dữ liệu không gắn được quan hệ và bảng kỹ thuật chỉ giữ CSV nguồn. Không replay queue/job, không tự gán ownership.' : actions[group.category] })) }
}
export function reviewMarkdown(review: ReturnType<typeof exportReview>): string {
  return `# Kết quả export PW1\n\n- Export: ${review.exportStatus}\n- Dữ liệu: ${review.dataStatus}\n- Import: ${review.importStatus} (chưa kiểm tra DB đích)\n- Store chưa xuất: ${review.blockedStoreCount}; loại theo policy: ${review.policyExcludedStoreCount}.\n\nSố dưới đây là diagnostics, không phải số record mất. Một record có thể xuất hiện nhiều lần. Xem export-review.json để lấy Store/source ID ví dụ; mapping-report.json giữ toàn bộ bằng chứng.\n\n| Nhóm | Mã | Table/field | Reason | Số diagnostics | Số Store | Ví dụ Store/record | Cần làm |\n|---|---|---|---|---:|---:|---|---|\n` + review.groups.map(g => `| ${g.category} | ${g.code} | ${g.table ?? ''}${g.field ? '.' + g.field : ''} | ${g.reason ?? ''} | ${g.count} | ${g.affectedStores} | ${g.examples.map(e => `${e.storeId ?? 'global'}/${e.sourceId ?? '-'}`).join(', ')} | ${g.action} |`).join('\n') + '\n'
}
