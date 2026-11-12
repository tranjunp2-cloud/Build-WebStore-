'use client';
import { useEffect, useRef, useState } from 'react';
import { FIELD_STATUSES, fieldEvidenceRates, type FieldEvidenceResult, type FieldStatus } from '@/lib/admin/qa/field-evidence-summary';
import type { SourceCoverage } from '@/lib/admin/qa/f42-source-coverage-reader';

const labels: Record<FieldStatus, string> = { match: 'Khớp', mismatch: 'Khác dữ liệu', missing: 'Thiếu', duplicate: 'Nhân đôi', unsupported: 'Chưa hỗ trợ', unverified: 'Chưa xác minh' };
const entities = [
  ['all', 'Tất cả nhóm'], ['products', 'Sản phẩm / SKU'], ['orders', 'Đơn hàng'],
  ['discounts', 'Giảm giá'], ['customers', 'Khách hàng'],
] as const;
type Entity = typeof entities[number][0];
const commerceTables = new Set([
  'products', 'product_skus', 'product_variants', 'product_attributes', 'product_images',
  'product_sku_images', 'product_sku_promotion_prices', 'orders', 'order_details',
  'order_status_histories', 'customers', 'addresses', 'promotions', 'promotion_codes',
  'promotion_product_skus', 'vouchers', 'voucher_product_skus',
]);
const sharedTables = new Set(['categories', 'brands', 'medias']);
function sourceValue(row: FieldEvidenceResult['rows'][number]) {
  if (row.source === '') return 'Chuỗi rỗng';
  if (row.source !== null) return row.source;
  if (row.sourcePresence === 'absent') return 'Không có trong nguồn';
  if (row.sourcePresence === 'null') return 'NULL';
  if (row.sourcePresence === 'empty') return 'Chuỗi rỗng';
  return 'Đã ẩn / chưa có bằng chứng';
}
function targetValue(row: FieldEvidenceResult['rows'][number]) {
  if (row.target === '') return 'Chuỗi rỗng';
  if (row.target !== null) return row.target;
  if (row.status === 'missing') return 'Bản ghi hoặc trường PW2 thiếu (đã xác minh)';
  return 'Đã ẩn / chưa có bằng chứng';
}
const fieldNames: Record<string, string> = {
  'product_skus.available': 'Tồn khả dụng',
  'product_skus.cost': 'Giá vốn',
  'product_skus.price': 'Giá bán',
  'product_skus.reserved': 'Tồn đã đặt trước',
  'product_skus.sku': 'Mã SKU',
  'product_skus.stock': 'Tồn kho',
  'product_skus.warehouse_location': 'Vị trí kho',
};
const reasonNames: Record<string, string> = {
  NORMALIZED_VALUE_EQUAL: 'Giá trị khớp sau chuẩn hóa.',
  PW2_PRODUCT_COST_NOT_MIGRATED: 'Giá vốn chưa được chuyển sang PW2.',
  AVAILABLE_SOURCE_UNAVAILABLE: 'Chưa có bằng chứng nguồn cho tồn khả dụng.',
  RESERVATION_SOURCE_UNAVAILABLE: 'Chưa có bằng chứng nguồn cho tồn đã đặt.',
  LOCATION_SOURCE_UNAVAILABLE: 'Chưa có bằng chứng nguồn cho vị trí kho.',
};
const formatCount = (value: number) => value.toLocaleString('vi-VN');
export function FieldEvidencePanel({ store, scope, refresh, selectedRunId }: { store: string; scope: 'commerce' | 'settings'; refresh: number; selectedRunId: string | null }) {
  const [status, setStatus] = useState<FieldStatus | 'all'>('all');
  const [entity, setEntity] = useState<Entity>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FieldEvidenceResult | null>(null);
  const [coverageTarget, setCoverageTarget] = useState<{
    store: string; scope: 'commerce' | 'settings'; runId: string | null;
    refresh: number; snapshotId: string | null;
  } | null>(null);
  const [sourceCoverage, setSourceCoverage] = useState<SourceCoverage | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const versionRef = useRef<{ generationId: string; digest: string } | null>(null);
  useEffect(() => {
    setCoverageTarget(null); setSourceCoverage(null);
    versionRef.current = null;
  }, [store, scope, refresh, selectedRunId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError('');
    if (!selectedRunId) {
      setLoading(false);
      setCoverageTarget({ store, scope, runId: null, refresh, snapshotId: null });
      return () => controller.abort();
    }
    void (async () => {
      try {
        const params = new URLSearchParams({ view: 'fields', store_id: store, scope, page: String(page), status, entity, run_id: selectedRunId });
        if (versionRef.current) {
          params.set('generation_id', versionRef.current.generationId);
          params.set('generation_digest', versionRef.current.digest);
        }
        const response = await fetch(`/api/qa/migration-reconciliation?${params}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
          const failure = await response.json().catch(() => null);
          throw new Error(response.status === 409
            ? 'Generation F42 đã thay đổi. Làm mới evidence để tiếp tục.'
            : failure?.code === 'F42_SOURCE_UNAVAILABLE'
            ? 'Nguồn F42 chưa sẵn sàng. Nhờ team F42 triển khai schema/evidence tương ứng rồi làm mới.'
            : 'Không tải được dữ liệu đối soát. Bấm làm mới để thử lại.');
        }
        const body = await response.json();
        if (!controller.signal.aborted) {
          setData(body.data);
          if (body.data?.summary) versionRef.current = {
            generationId: body.data.summary.generationId, digest: body.data.summary.digest,
          };
          setCoverageTarget({ store, scope, runId: selectedRunId, refresh,
            snapshotId: body.data?.summary?.snapshotId ?? null });
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.');
          setCoverageTarget(previous => previous ?? { store, scope, runId: selectedRunId, refresh, snapshotId: null });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [store, scope, refresh, selectedRunId, page, status, entity]);
  const summary = data?.summary;
  const rates = summary ? fieldEvidenceRates(summary.counts) : null;
  useEffect(() => {
    if (!coverageTarget || coverageTarget.scope !== 'commerce') return;
    const controller = new AbortController();
    setSourceCoverage(null); setSourceError('');
    const snapshot = coverageTarget.snapshotId ? `&snapshot_id=${encodeURIComponent(coverageTarget.snapshotId)}` : '';
    void (async () => {
      try {
        const response = await fetch(`/api/qa/migration-reconciliation?view=source_coverage&store_id=${encodeURIComponent(coverageTarget.store)}${snapshot}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Không đọc được kiểm kê nguồn PW1.');
        const body = await response.json();
        if (!controller.signal.aborted) setSourceCoverage(body.data as SourceCoverage);
      } catch {
        if (!controller.signal.aborted) setSourceError('Không đọc được kiểm kê nguồn PW1.');
      }
    })();
    return () => controller.abort();
  }, [coverageTarget?.store, coverageTarget?.scope, coverageTarget?.runId,
    coverageTarget?.refresh, coverageTarget?.snapshotId]);
  const commerceBuckets = sourceCoverage?.buckets.filter(row => commerceTables.has(row.entity)) ?? [];
  const sourceRecords = commerceBuckets.reduce((total, row) => total + row.records, 0);
  const sourceFields = commerceBuckets.reduce((total, row) => total + row.comparableFields + row.redactedFields, 0);
  const sharedRecords = sourceCoverage?.buckets.filter(row => sharedTables.has(row.entity)).reduce((total, row) => total + row.records, 0) ?? 0;
  const outsideRegistry = sourceCoverage?.outsideRegistry.filter(row => commerceTables.has(row.entity)).reduce((total, row) => total + row.fields, 0) ?? 0;
  const provenDiffs = summary ? summary.counts.mismatch + summary.counts.missing + summary.counts.duplicate : 0;
  const pendingFields = summary ? summary.counts.unsupported + summary.counts.unverified : 0;
  const sourceMapped = commerceBuckets.filter(row => row.disposition === 'mapped').reduce((total, row) => total + row.records, 0);
  const sourceRetained = commerceBuckets.filter(row => row.disposition === 'retained-source').reduce((total, row) => total + row.records, 0);
  const sourceOther = sourceRecords - sourceMapped - sourceRetained;
  return <section className="rounded-2xl border border-sky-800/50 bg-slate-950 p-4 text-slate-200 space-y-3" aria-label="Đối soát từng trường F42">
    <h3 className="text-lg font-semibold text-white">Độ khớp dữ liệu {scope === 'commerce' ? 'Commerce' : 'Settings'}</h3>
    {scope === 'commerce' && !loading && <div role="status" className="rounded-xl border border-amber-600/40 bg-amber-950/30 p-4">
      <p className="text-base font-semibold text-amber-100">{provenDiffs > 0 ? 'Đã phát hiện dữ liệu khác trong phần kiểm tra' : 'Chưa thể kết luận dữ liệu Commerce đã chuyển đủ và đúng'}</p>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-200">{summary
        ? `${formatCount(summary.counts.match)} trường khớp trong ${formatCount(rates?.checked ?? 0)} trường đã kiểm tra. ${formatCount(pendingFields)} trường trong danh mục QC còn chưa thể kết luận.`
        : 'Chưa có bằng chứng đối chiếu từng trường cho migration run này.'} Kết quả QC website được đánh giá riêng.</p>
    </div>}
    {scope === 'commerce' && <div className="grid gap-3 md:grid-cols-2" aria-label="Hai phạm vi đối soát Commerce">
      <div data-testid="commerce-source-coverage" className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm">
        <h4 className="font-semibold text-white">1. Dữ liệu gốc trong PW1</h4>
        {sourceError ? <p role="alert" className="text-rose-300">{sourceError}</p> : !sourceCoverage ? <p role="status">Đang đọc kiểm kê nguồn…</p> : sourceCoverage.state !== 'complete' ? <p className="text-amber-200">Chưa đủ bằng chứng: {sourceCoverage.reason}</p> : <>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-white">{formatCount(sourceRecords)} <span className="text-sm font-normal text-slate-300">bản ghi ở các bảng Commerce của Store này</span></p>
          <p className="mt-2 leading-6 text-slate-300">{formatCount(sourceMapped)} có liên kết nguồn để đối chiếu PW2 · {formatCount(sourceRetained)} giữ ở nguồn{sourceOther > 0 ? ` · ${formatCount(sourceOther)} thuộc trạng thái khác` : ''}.</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Số liệu lấy từ snapshot trước khi lọc. “Giữ ở nguồn” không có nghĩa thiếu trên PW2.</p>
        </>}
      </div>
      <div data-testid="commerce-import-fidelity" className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm">
        <h4 className="font-semibold text-white">2. Các trường đã được đối chiếu</h4>
        {!summary ? <p className="mt-3 text-amber-200">{selectedRunId ? 'Chưa có generation hợp lệ cho run VERIFIED đang chọn.' : 'Chưa chọn migration run VERIFIED.'}</p> : <>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-white">{formatCount(rates?.checked ?? 0)} / {formatCount(rates?.total ?? 0)} <span className="text-sm font-normal text-slate-300">trường đã kiểm tra</span></p>
          <p className="mt-2 leading-6 text-slate-300">{formatCount(summary.counts.match)} khớp · {formatCount(provenDiffs)} có sai lệch · {formatCount(pendingFields)} chưa thể kết luận.</p>
          <p className="mt-1 text-xs leading-5 text-amber-200">{rates?.matchRate ?? '—'}% chỉ là tỷ lệ khớp <strong>trong phần đã kiểm tra</strong>. Danh mục QC hiện chưa bao phủ mọi trường cần import.</p>
        </>}
      </div>
    </div>}
    {scope === 'commerce' && <p className="text-xs leading-5 text-slate-400">Bản ghi là một sản phẩm, đơn hàng hoặc dữ liệu tương tự; một bản ghi có nhiều trường. Vì vậy số bản ghi nguồn và số lượt trường QC không cộng hoặc so trực tiếp với nhau.</p>}
    {loading ? <p role="status">Đang đọc bằng chứng đối soát…</p> : error ? <p role="alert" className="text-rose-300">{error}</p> : !summary ? <p className="text-amber-200">{selectedRunId ? 'Chưa có field evidence F42 hợp lệ cho run đang chọn.' : 'Chưa có run VERIFIED để đối chiếu field.'} Kiểm kê nguồn PW1 ở trên vẫn đọc độc lập từ snapshot F42.</p> : scope === 'commerce' ? <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm">
      <h4 className="font-semibold text-white">Còn phải kiểm tra trước khi kết luận</h4>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-6 text-slate-300">
        {pendingFields > 0 && <li><strong className="text-amber-200">{formatCount(pendingFields)} lượt trường chưa thể kết luận:</strong> {formatCount(summary.counts.unsupported)} chưa có quy tắc so sánh, {formatCount(summary.counts.unverified)} chưa đủ bằng chứng.</li>}
        {outsideRegistry > 0 && <li><strong className="text-amber-200">{formatCount(outsideRegistry)} lượt trường nguồn chưa nằm trong danh mục QC.</strong> Cần xác định trường nào bắt buộc chuyển; đây là số lượt theo bản ghi, không phải số tên trường khác nhau.</li>}
        {(summary.targetDriftCheck === 'not_run' || !summary.targetDriftCheck) && <li><strong className="text-amber-200">PW2 hiện tại chưa được kiểm tra lại.</strong> Bảng dưới phản ánh bằng chứng tại thời điểm migration, không xác nhận dữ liệu còn nguyên ở hiện tại.</li>}
        <li>Chưa có danh sách trường bắt buộc import tách khỏi nhóm giữ ở nguồn, nên chưa tính được tỷ lệ chuyển đủ dữ liệu.</li>
      </ul>
    </div> : <p className="text-sm text-slate-300">Đã kiểm tra {formatCount(rates?.checked ?? 0)}/{formatCount(rates?.total ?? 0)} trường · {formatCount(summary.counts.match)} khớp · {formatCount(pendingFields)} chưa thể kết luận.</p>}
    {scope === 'commerce' && <details className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-xs text-slate-300">
      <summary className="cursor-pointer rounded text-sm font-medium text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">Xem kiểm kê nguồn và thông tin kỹ thuật</summary>
      {sourceCoverage?.state === 'complete' && <div className="mt-3 space-y-2 leading-5">
        <p>{formatCount(sourceCoverage.records)} bản ghi được gắn Store trong snapshot; {sourceCoverage.snapshotRecords === null ? 'chưa có số tổng' : formatCount(sourceCoverage.snapshotRecords)} bản ghi toàn snapshot; {formatCount(sourceRecords)} bản ghi ở các bảng Commerce chính; {formatCount(sharedRecords)} bản ghi dùng chung ở categories, brands, medias.</p>
        <p>Trường Commerce chính: {formatCount(sourceFields)} lượt; ngoài danh mục QC: {formatCount(outsideRegistry)} lượt. Toàn snapshot còn {formatCount(sourceCoverage.unattributed.records)} bản ghi chưa quy được Store; chưa thể coi đây là lỗi riêng Store này.</p>
        <p>Phân loại bản ghi nguồn: {sourceCoverage.buckets.map(row => `${row.entity}/${row.disposition}: ${formatCount(row.records)}`).join(' · ')}</p>
        <p>Phân loại lượt trường nguồn: {sourceCoverage.fieldDispositions.map(row => `${row.entity}/${row.disposition}: ${formatCount(row.fields)}`).join(' · ')}</p>
        <p>Snapshot: {sourceCoverage.sourceSnapshotId ?? sourceCoverage.snapshotId} · {sourceCoverage.sourceSnapshotAt ? new Date(sourceCoverage.sourceSnapshotAt).toLocaleString('vi-VN') : 'chưa ghi thời gian'} · {formatCount(sourceCoverage.selectedFiles.length)} selected CSV.</p>
        {!coverageTarget?.snapshotId && <p role="note" className="text-amber-200">Kiểm kê này lấy từ snapshot nguồn mới nhất của Store, chưa gắn với snapshot của run đang chọn.</p>}
        <p className="break-all">Manifest SHA-256: {sourceCoverage.manifestSha256 ?? 'Chưa có'} · Sidecar SHA-256: {sourceCoverage.sidecarSha256 ?? 'Chưa có'}</p>
        <details><summary className="cursor-pointer text-sky-300">Xem danh sách selected CSV</summary><ul className="mt-1 list-disc pl-5">{sourceCoverage.selectedFiles.map(file => <li key={file.table}>{file.table}: {file.rowCount === null ? 'chưa có số dòng' : formatCount(file.rowCount)} dòng</li>)}</ul></details>
      </div>}
      {summary && <div className="mt-3 space-y-2 leading-5">
        <p>QC: {formatCount(rates?.checked ?? 0)}/{formatCount(rates?.total ?? 0)} lượt trường đã kiểm tra ({rates?.coverage ?? '—'}%) · tỷ lệ khớp trong phần đã kiểm tra {rates?.matchRate ?? '—'}% · issue mở {summary.openExceptions}.</p>
        <p>Ngoài phần so sánh của run: {formatCount(summary.outsideComparison)} lượt trường. Ngoài danh mục QC toàn run: {formatCount(summary.outsideScope)} lượt trường. Chỉ giá trị được F42 lưu theo danh mục cho phép mới hiển thị với Super Admin.</p>
        <p>Nguồn: {summary.sourceSnapshotAt ? new Date(summary.sourceSnapshotAt).toLocaleString('vi-VN') : 'chưa ghi thời gian snapshot'} · xác minh: {new Date(summary.verifiedAt).toLocaleString('vi-VN')} · PW2 hiện tại: {summary.targetDriftCheck === 'not_run' || !summary.targetDriftCheck ? 'chưa kiểm tra' : summary.targetDriftCheck}.</p>
        <p className="break-all">Nguồn: {summary.sourceInstance ?? 'chưa rõ'} · đích: {summary.targetInstance ?? 'chưa rõ'} · run: {summary.runId} · snapshot: {summary.sourceSnapshotId ?? summary.snapshotId ?? 'chưa có'} · generation: {summary.generationId} · registry: {summary.registryVersion ?? 'chưa rõ'} · digest: {summary.digest}</p>
      </div>}
    </details>}
    <details open={scope === 'settings'} className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
      <summary className="cursor-pointer rounded font-medium text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">Xem từng trường và lọc kết quả{rates ? ` (${formatCount(rates.total)})` : ''}</summary>
      <div className="mt-4 space-y-3">
    {scope === 'commerce' && <div className="flex flex-wrap gap-2" aria-label="Lọc nhóm Commerce">{entities.map(([value, label]) => {
      const counts = value === 'all' ? null : data?.byEntity?.[value];
      const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : null;
      return <button key={value} type="button" aria-pressed={entity === value} onClick={() => { setEntity(value); setPage(1); }} className={`rounded-lg px-3 py-2 text-xs ${entity === value ? 'bg-blue-600 text-white' : 'bg-slate-800'}`}>{label}{total !== null ? ` (${total})` : ''}</button>;
    })}</div>}
    <div className="flex flex-wrap gap-2" aria-label="Lọc trạng thái field">
      {(['all', ...FIELD_STATUSES] as const).map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`rounded-lg px-3 py-2 text-xs ${status === value ? 'bg-blue-600 text-white' : 'bg-slate-800'}`}>{value === 'all' ? 'Tất cả' : labels[value]}{summary && entity === 'all' && value !== 'all' ? ` (${summary.counts[value]})` : ''}</button>)}
    </div>
    {summary && <>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Đối soát từng trường PW1 và PW2 theo nhóm và trạng thái đã chọn</caption><thead><tr>{['Trường / bản ghi', 'PW1', 'PW2', 'Kết quả', 'Lý do'].map(label => <th scope="col" className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>
        {data.rows.map((row, index) => <tr key={`${row.key}-${row.record}-${index}`} className="border-t border-slate-800"><td className="p-2"><strong className="text-slate-100">{fieldNames[row.key] ?? row.key}</strong>{fieldNames[row.key] && <><br /><span className="text-slate-400">{row.key}</span></>}<br /><span className="text-slate-400">{row.record} · {row.disposition}</span></td><td className="p-2 break-all">{sourceValue(row)}</td><td className="p-2 break-all">{targetValue(row)}</td><td className="p-2">{labels[row.status]}</td><td className="p-2">{reasonNames[row.reason] ?? row.reason}{reasonNames[row.reason] && <><br /><span className="text-slate-500">{row.reason}</span></>}</td></tr>)}
      </tbody></table></div>
      {!data.rows.length && <p>Không có trường thuộc trạng thái đang lọc.</p>}
      <div className="flex gap-3 text-xs items-center"><button type="button" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Trang trước</button><span>{page} / {Math.max(1, Math.ceil(data.total / 100))} · {data.total} trường</span><button type="button" disabled={page * 100 >= data.total || loading} onClick={() => setPage(p => p + 1)}>Trang sau</button></div>
    </>}
      </div>
    </details>
  </section>;
}
