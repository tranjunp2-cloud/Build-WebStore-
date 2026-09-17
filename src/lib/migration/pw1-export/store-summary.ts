import { ROOTS, type Diagnostic, type StoreOutput } from './contracts'
import { compareIds } from './primitives'

// Classification describes the work remaining, never changes diagnostic severity.
const reviewCodes = new Set([
  'SITE_TYPE_DEFAULT_REQUIRES_REVIEW', 'SITE_SHIPPING_MAPPING_UNRESOLVED',
  'USER_CREATOR_UNRESOLVED', 'CATEGORY_STATUS_PARITY', 'EMAIL_GREETING_SEMANTICS',
  'PRODUCT_DESCRIPTION_STYLE_FIDELITY', 'PRODUCT_DESCRIPTION_CONTENT_FIDELITY',
  'PRODUCT_DESCRIPTION_ATTRIBUTE_FIDELITY',
])
const targetCodes = new Set(['TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP', 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED', 'TARGET_USER_CREATOR_BINDING_REQUIRED'])
const reasons: Record<string, string> = {
  TENANT_LIFECYCLE_CONFLICT: 'Trạng thái Store, owner hoặc subscription mâu thuẫn theo quy tắc master.',
  USER_LIFECYCLE_CONFLICT: 'Trạng thái User không khớp ngày khóa/hết hạn hoặc lifecycle không hợp lệ.',
  SUBSCRIPTION_FUTURE_START: 'Subscription bắt đầu sau mốc asOf của lần export.',
  OWNER_IDENTITY_CONFLICT: 'Không xác định được owner hợp lệ duy nhất theo quan hệ và role nguồn.',
  STORE_NOT_LIVE: 'Store không tồn tại hoặc đã soft-delete trong snapshot.',
  TENANT_SLUG_INVALID: 'Tenant slug sai định dạng hoặc thuộc tên dành riêng.',
  USER_EMAIL_INVALID: 'Email User không hợp lệ.',
  DOMAIN_INVALID: 'Domain nguồn không hợp lệ.',
  SITE_TYPE_DEFAULT_REQUIRES_REVIEW: 'Giá trị siteType mặc định cần quyết định mapping, không có suy luận chung đã duyệt.',
  SITE_SHIPPING_MAPPING_UNRESOLVED: 'Cấu hình vận chuyển PW1 chưa tương đương cấu hình phí/setup PW2.',
  TARGET_USER_CREATOR_BINDING_REQUIRED: 'Creator đã giữ trong user-actors.json; importer phải resolve tài khoản hệ thống sang ID PW2, không tạo membership giả.',
  USER_CREATOR_UNRESOLVED: 'created_by chưa resolve sang User đủ điều kiện; không tự cấp membership cho actor ngoài tenant.',
  CATEGORY_STATUS_PARITY: 'PW2 chưa có trạng thái Category tương đương trạng thái nguồn.',
  EMAIL_GREETING_SEMANTICS: 'Chuỗi email được giữ nhưng vị trí lời chào và bố cục PW2 khác PW1.',
  TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP: 'Product được giữ theo tenant; unique index toàn cục PW2 cần xử lý trước import.',
  TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED: 'Blog/danh mục blog được giữ theo tenant; cần triển khai và xác minh unique index theo tenant trên DB đích trước import.',
  SHORT_DESCRIPTION_TOO_LONG: 'Mô tả ngắn vượt 300 ký tự: bỏ field đích, giữ Product nếu phần còn lại hợp lệ; raw chịu kiểm tra an toàn riêng.',
  RAW_VALUE_UNVERIFIED: 'Giá trị raw chưa qua kiểm tra cấu trúc/an toàn nên chưa đưa vào JSON.',
  RAW_OWNERSHIP_MISSING: 'Thiếu bằng chứng sở hữu raw; không suy tenant để đưa dữ liệu vào sai Store.',
}
export function storeSummaries(
  master: StoreOutput[], diagnostics: Diagnostic[], blocked: string[], excluded: string[],
) {
  const output = new Map(master.map(store => [
    String((store.tenants[0].metaData as { pw1StoreId: string }).pw1StoreId), store,
  ]))
  const blockedIds = new Set(blocked)
  const excludedIds = new Set(excluded)
  const byStore = new Map<string, Diagnostic[]>()
  for (const diagnostic of diagnostics) {
    if (!diagnostic.storeId) continue
    const group = byStore.get(diagnostic.storeId) ?? []
    group.push(diagnostic)
    byStore.set(diagnostic.storeId, group)
  }
  return [...new Set([...output.keys(), ...blocked, ...excluded])].sort(compareIds).map(storeId => {
    const store = output.get(storeId)
    const issues = byStore.get(storeId) ?? []
    const blockers = issues.filter(d => d.severity === 'blocker')
    const codes = [...new Set(blockers.map(d => d.code))].sort()
    const exportStatus = blockedIds.has(storeId) ? 'blocked' : excludedIds.has(storeId) ? 'excluded' : 'emitted'
    return {
      storeId, exportStatus,
      mappingStatus: exportStatus === 'excluded' ? 'excluded' : blockers.length ? 'needs_review' : 'no_store_blockers',
      // Global diagnostics remain in mapping-report.json; no_store_blockers is not import readiness.
      blockerDiagnosticCount: blockers.length,
      warningDiagnosticCount: issues.length - blockers.length,
      blockerCodes: codes,
      reasons: codes.map(code => ({ code, explanation: reasons[code] ?? 'Xem diagnostics và field dispositions trong mapping-report.json để xác định record/field bị ảnh hưởng.' })),
      mappingReviewCodes: codes.filter(code => reviewCodes.has(code)),
      targetConstraintCodes: codes.filter(code => targetCodes.has(code)),
      otherBlockerCodes: codes.filter(code => !reviewCodes.has(code) && !targetCodes.has(code)),
      collectionCounts: Object.fromEntries(ROOTS.map(root => [root, store?.[root].length ?? 0])),
    }
  })
}
