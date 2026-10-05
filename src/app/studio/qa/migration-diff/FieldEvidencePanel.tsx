'use client';
import { useEffect, useState } from 'react';
import { FIELD_STATUSES, fieldEvidenceRates, type FieldEvidenceResult, type FieldStatus } from '@/lib/admin/qa/field-evidence-summary';

const labels: Record<FieldStatus, string> = { match: 'Khớp', mismatch: 'Khác dữ liệu', missing: 'Thiếu', duplicate: 'Nhân đôi', unsupported: 'Chưa hỗ trợ', unverified: 'Chưa xác minh' };
export function FieldEvidencePanel({ store, scope, refresh }: { store: string; scope: 'commerce' | 'settings'; refresh: number }) {
  const [status, setStatus] = useState<FieldStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FieldEvidenceResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/qa/migration-reconciliation?view=fields&store_id=${encodeURIComponent(store)}&scope=${scope}&page=${page}&status=${status}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
          const failure = await response.json().catch(() => null);
          throw new Error(failure?.code === 'F42_SOURCE_UNAVAILABLE'
            ? 'Nguồn F42 chưa sẵn sàng. Nhờ team F42 triển khai schema/evidence tương ứng rồi làm mới.'
            : 'Không tải được dữ liệu đối soát. Bấm làm mới để thử lại.');
        }
        const body = await response.json();
        if (!controller.signal.aborted) setData(body.data);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [store, scope, refresh, page, status]);
  const summary = data?.summary;
  const rates = summary ? fieldEvidenceRates(summary.counts) : null;
  return <section className="rounded-2xl border border-sky-800/50 bg-slate-950 p-4 text-slate-200 space-y-3" aria-label="Đối soát từng trường F42">
    <h3 className="font-bold">Độ khớp dữ liệu {scope === 'commerce' ? 'Commerce' : 'Settings'}</h3>
    {loading ? <p role="status">Đang đọc bằng chứng đối soát…</p> : error ? <p role="alert" className="text-rose-300">{error}</p> : !summary ? <p className="text-amber-200">Chưa có field evidence F42 hợp lệ cho đợt migration mới nhất. Mapping ID không đủ để tính % khớp. Cần F42 tạo evidence từ snapshot nguồn của đợt này.</p> : <>
      <div className="flex flex-wrap gap-5 text-sm">
        <p>Đã kiểm tra: <strong>{rates?.coverage ?? '—'}{rates?.coverage !== null ? '%' : ''}</strong> ({rates?.checked}/{rates?.total} trường đã ghi nhận)</p>
        <p>Khớp trong phần đã kiểm tra: <strong>{rates?.matchRate ?? '—'}{rates?.matchRate !== null ? '%' : ''}</strong></p>
        <p>Issue mở: <strong>{summary.openExceptions}</strong></p>
      </div>
      <p className="text-xs text-amber-200">Kết quả tại thời điểm migration, chưa kiểm tra thay đổi PW2 sau đó. Đây không phải % giao diện hoặc kết luận đủ toàn bộ dữ liệu website.</p>
      {summary.outsideComparison > 0 && <p className="text-xs text-amber-200">Còn {summary.outsideComparison} trường nguồn ngoài phần đã tạo evidence của run này.</p>}
      <p className="text-xs text-slate-400">Nguồn: {summary.sourceSnapshotAt ? new Date(summary.sourceSnapshotAt).toLocaleString('vi-VN') : 'Chưa ghi thời gian snapshot'} · Xác minh: {new Date(summary.verifiedAt).toLocaleString('vi-VN')} · Ngoài danh mục QC toàn run: {summary.outsideScope} trường</p>
      <p className="text-xs text-slate-400 break-all">Phiên bản evidence: {summary.generationId} · Digest: {summary.digest}</p>
      <p className="text-xs text-slate-400">Đã kiểm tra = Khớp + Khác + Thiếu + Nhân đôi. Chưa hỗ trợ/Chưa xác minh vẫn nằm trong tổng; giá trị riêng tư được ẩn.</p>
    </>}
    <div className="flex flex-wrap gap-2" aria-label="Lọc trạng thái field">
      {(['all', ...FIELD_STATUSES] as const).map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`rounded-lg px-3 py-2 text-xs ${status === value ? 'bg-blue-600 text-white' : 'bg-slate-800'}`}>{value === 'all' ? 'Tất cả' : labels[value]}{summary && value !== 'all' ? ` (${summary.counts[value]})` : ''}</button>)}
    </div>
    {summary && <>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Trường / bản ghi', 'PW1', 'PW2', 'Kết quả', 'Lý do'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>
        {data.rows.map((row, index) => <tr key={`${row.key}-${row.record}-${index}`} className="border-t border-slate-800"><td className="p-2">{row.key}<br /><span className="text-slate-400">{row.record} · {row.disposition}</span></td><td className="p-2 break-all">{row.source ?? '— / đã ẩn'}</td><td className="p-2 break-all">{row.target ?? '— / đã ẩn'}</td><td className="p-2">{labels[row.status]}</td><td className="p-2">{row.reason}</td></tr>)}
      </tbody></table></div>
      {!data.rows.length && <p>Không có trường thuộc trạng thái đang lọc.</p>}
      <div className="flex gap-3 text-xs items-center"><button type="button" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Trang trước</button><span>{page} / {Math.max(1, Math.ceil(data.total / 100))} · {data.total} trường</span><button type="button" disabled={page * 100 >= data.total || loading} onClick={() => setPage(p => p + 1)}>Trang sau</button></div>
    </>}
  </section>;
}
