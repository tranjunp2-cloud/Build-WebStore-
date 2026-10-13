import { fieldEvidenceRates } from './field-evidence-summary';
import type { MigrationStore } from './website-migration-compare';

export type MigrationReportStatus = 'passed' | 'failed' | 'review' | 'insufficient';
export type MigrationReportResult = { status: MigrationReportStatus; reasons: string[] };

/** Historical projection evidence is not a live-PW2 or whole-website acceptance contract.
 * Priority: proven failures > stale results requiring recheck > missing evidence > review.
 * `passed` is intentionally reserved until a complete required-scope contract exists.
 * Manual QC never overwrites the automatic result.
 */
export function classifyMigrationReport(store: MigrationStore): MigrationReportResult {
  const failures: string[] = [];
  const rechecks: string[] = [];
  const missing: string[] = [];
  const review: string[] = [];
  const fields = store.fieldEvidence;
  const staleAudit = store.auditStatus === 'stale' || store.auditStatus === 'historical';
  const currentAudit = !!store.checkedAt && !staleAudit &&
    ['checked', 'needs-fix', 'needs-review', 'waiting-be'].includes(store.auditStatus);

  if (store.migration === 'failed') failures.push('Migration thất bại; kiểm tra lỗi của lần chạy F42.');
  else if (store.migration !== 'completed') missing.push('Migration chưa hoàn tất.');
  if (currentAudit && (store.errors > 0 || store.auditStatus === 'needs-fix')) {
    failures.push(`Audit hiện tại báo lỗi (${store.errors}); mở chi tiết để xử lý.`);
  }
  if (store.websiteComparison !== undefined) {
    const website = store.websiteComparison;
    if (!website?.total) missing.push('Chưa có dữ liệu đối soát website.');
    else {
      if (website.mismatched) failures.push(`${website.mismatched} field website khác; cần kiểm tra.`);
      if (website.unverified) missing.push(`${website.unverified} field website chưa xác minh.`);
    }
  } else if (fields) {
    const { counts } = fields;
    if (counts.mismatch > 0) failures.push(`${counts.mismatch} trường dữ liệu sai lệch trong evidence F42.`);
    if (counts.missing > 0) failures.push(`${counts.missing} trường dữ liệu bị thiếu trong evidence F42.`);
    if (counts.duplicate > 0) failures.push(`${counts.duplicate} trường dữ liệu bị nhân đôi trong evidence F42.`);
    if (fieldEvidenceRates(counts).total === 0) missing.push('Evidence chưa có trường dữ liệu để đối soát.');
    if (counts.unsupported > 0) missing.push(`${counts.unsupported} trường chưa được hỗ trợ đối soát.`);
    if (counts.unverified > 0) missing.push(`${counts.unverified} trường chưa được xác minh.`);
    if (fields.outsideScope > 0) missing.push(`${fields.outsideScope} trường nằm ngoài phạm vi đối soát.`);
    if (fields.outsideComparison > 0) missing.push(`${fields.outsideComparison} trường nguồn chưa nằm trong lần so sánh.`);
    if (fields.openExceptions > 0) review.push(`${fields.openExceptions} issue F42 đang mở; cần xem mức độ và xử lý.`);
  } else missing.push('Chưa có field evidence F42 để đối soát dữ liệu.');

  if (staleAudit) rechecks.push('Audit đã cũ hoặc chưa xác nhận phiên bản; cần chạy lại audit.');
  else if (!currentAudit) missing.push('Chưa có audit hoàn chỉnh cho phiên bản hiện tại.');
  if (store.qcStatus === 'unverified' && store.reviewedAt) {
    rechecks.push('Kết luận QC trước không còn hiệu lực; cần kiểm tra lại phần thay đổi.');
  }
  if (currentAudit && store.warnings > 0) review.push(`${store.warnings} cảnh báo audit cần kiểm tra.`);
  if (currentAudit && store.auditStatus === 'waiting-be') missing.push('Audit còn hạng mục chờ dữ liệu backend.');
  if (currentAudit && store.auditStatus === 'needs-review') review.push('Audit yêu cầu kiểm tra thêm.');
  if (store.pageCount === 0) missing.push('Chưa có trang PW2 để kiểm tra website.');
  if (store.publish !== 'published') review.push('Website PW2 chưa publish; cần kiểm tra trạng thái phát hành.');

  const reasons = [...failures, ...rechecks, ...missing, ...review];
  if (failures.length) return { status: 'failed', reasons };
  if (rechecks.length) return { status: 'review', reasons };
  if (missing.length) return { status: 'insufficient', reasons };
  return {
    status: 'review',
    reasons: [...reasons, 'Các trường đã ghi nhận khớp chưa chứng minh đủ toàn bộ website; cần xác nhận phạm vi nghiệm thu và giao diện.'],
  };
}
