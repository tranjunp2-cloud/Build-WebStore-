'use client';

import { useEffect, useState } from 'react';
import { FIELD_STATUSES, fieldEvidenceRates, type FieldStatus, type RecordFieldEvidenceResult } from '@/lib/admin/qa/field-evidence-summary';

const statusLabels: Record<FieldStatus, string> = {
  match: 'Khớp', mismatch: 'Khác dữ liệu', missing: 'Thiếu', duplicate: 'Nhân đôi',
  unsupported: 'Chưa hỗ trợ', unverified: 'Chưa xác minh',
};
const fieldLabels: Record<string, string> = {
  'products.name': 'Tên sản phẩm', 'products.slug': 'Đường dẫn sản phẩm',
  'products.status': 'Trạng thái sản phẩm', 'products.category_id': 'Danh mục',
  'products.currency': 'Tiền tệ', 'products.image_count': 'Số ảnh',
  'products.image_identity': 'Bộ ảnh', 'products.package_weight': 'Cân nặng',
  'products.package_weight_type': 'Đơn vị cân nặng',
  'products.package_length': 'Chiều dài', 'products.package_width': 'Chiều rộng',
  'products.package_height': 'Chiều cao', 'product_skus.sku': 'Mã SKU',
  'product_skus.price': 'Giá bán SKU', 'product_skus.cost': 'Giá vốn SKU',
  'product_skus.stock': 'Tồn kho SKU', 'product_skus.reserved': 'Tồn đã đặt',
  'product_skus.available': 'Tồn khả dụng', 'product_skus.warehouse_location': 'Vị trí kho',
  'orders.code': 'Mã đơn hàng', 'orders.currency_id': 'Tiền tệ đơn hàng',
  'orders.sub_total': 'Tiền hàng', 'orders.total_discount': 'Giảm giá',
  'orders.total_shipping': 'Phí vận chuyển', 'orders.total_tax': 'Thuế',
  'orders.total': 'Tổng tiền', 'orders.status': 'Trạng thái đơn',
  'orders.purchase_status': 'Trạng thái thanh toán', 'orders.payment_method_id': 'Phương thức thanh toán',
  'orders.fulfilment_status': 'Trạng thái xử lý đơn', 'orders.shipping_status': 'Trạng thái giao hàng',
  'orders.refund_status': 'Trạng thái hoàn tiền', 'orders.cancel_state': 'Trạng thái hủy đơn',
  'order_details.product_sku_id': 'SKU của dòng hàng', 'order_details.sku': 'Mã SKU dòng hàng',
  'order_details.quantity': 'Số lượng dòng hàng', 'order_details.price': 'Đơn giá dòng hàng',
  'order_details.total_price': 'Thành tiền dòng hàng',
  'customers.identity': 'Định danh khách hàng', 'customers.email': 'Email khách hàng',
  'customers.address_count': 'Số địa chỉ',
  'promotion_codes.code': 'Mã giảm giá', 'promotions.discount_value': 'Giá trị giảm giá',
  'promotions.discount_type_id': 'Loại giảm giá', 'promotions.start_date': 'Ngày bắt đầu',
  'promotions.end_date': 'Ngày kết thúc', 'promotions.status': 'Trạng thái giảm giá',
};
const reasonLabels: Record<string, string> = {
  NORMALIZED_VALUE_EQUAL: 'Giá trị khớp sau khi áp dụng quy tắc chuyển đổi.',
  FIELD_NOT_MIGRATED: 'Trường này chưa được chuyển sang PW2.',
  FIELD_RULE_UNSUPPORTED: 'Chưa có quy tắc đối chiếu cho trường này.',
  CURRENCY_EQUAL: 'Tiền tệ khớp.',
  CATEGORY_IDENTITY_EQUAL: 'Danh mục đã được nối đúng theo quy tắc định danh.',
  IMAGE_COUNT_EQUAL: 'Số ảnh khớp tại thời điểm migration.',
  IMAGE_IDENTITY_EQUAL: 'Bộ ảnh khớp theo bằng chứng migration.',
  DISCOUNT_VALUE_EQUAL: 'Giá trị khớp sau khi quy đổi đơn vị giảm giá của PW1 sang PW2.',
  DISCOUNT_VALUE_DIFFERENT: 'Giá trị khác nhau sau khi quy đổi đơn vị giảm giá của PW1 sang PW2.',
  DIMENSION_CM_EQUAL: 'Kích thước khớp sau khi chuẩn hóa về cm.',
  WEIGHT_UNIT_EQUAL: 'Đơn vị cân nặng khớp sau chuyển đổi.',
  PW2_PRODUCT_COST_NOT_MIGRATED: 'Giá vốn chưa được chuyển sang PW2.',
  RESERVATION_SOURCE_UNAVAILABLE: 'Chưa có bằng chứng nguồn cho tồn đã đặt.',
  AVAILABLE_SOURCE_UNAVAILABLE: 'Chưa có bằng chứng nguồn cho tồn khả dụng.',
  LOCATION_SOURCE_UNAVAILABLE: 'Chưa có bằng chứng nguồn cho vị trí kho.',
};
const count = (value: number) => value.toLocaleString('vi-VN');

function shownValue(row: RecordFieldEvidenceResult['rows'][number], side: 'source' | 'target') {
  if (!row.displayAllowed) return 'Đã ẩn theo chính sách hiển thị';
  const value = row[side];
  if (value === '') return 'Chuỗi rỗng';
  if (value !== null) return value;
  if (['orders.code', 'promotion_codes.code', 'customers.email'].includes(row.key)) {
    return 'Evidence không lưu giá trị gốc';
  }
  if (side === 'source') {
    if (row.sourcePresence === 'absent') return 'Không có trong nguồn';
    if (row.sourcePresence === 'null') return 'NULL';
    if (row.sourcePresence === 'empty') return 'Chuỗi rỗng';
  }
  if (side === 'target' && row.status === 'missing') return 'Thiếu ở PW2 (đã xác minh)';
  return 'Chưa có giá trị hiển thị';
}

export function RecordFieldEvidencePanel({ storeId, runId, reference, version }: {
  storeId: string; runId: string; reference: string;
  version: { generationId: string; digest: string };
}) {
  const [status, setStatus] = useState<FieldStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RecordFieldEvidenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // State resets by remounting: the parent keys this panel by store, run, reference and version.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const params = new URLSearchParams({
      view: 'record_fields', scope: 'commerce', store_id: storeId, run_id: runId,
      record_ref: reference, status, page: String(page),
      generation_id: version.generationId, generation_digest: version.digest,
    });
    void (async () => {
      try {
        const response = await fetch(`/api/qa/migration-reconciliation?${params}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 || response.status === 409
          ? 'Bản ghi hoặc bằng chứng đã thay đổi. Đóng chi tiết và tải lại run.'
          : 'Không tải được bằng chứng của bản ghi. Hãy thử lại.');
        const body = await response.json();
        if (!controller.signal.aborted) setData(body.data as RecordFieldEvidenceResult);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được bằng chứng.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [storeId, runId, reference, version.generationId, version.digest, status, page]);
  const rates = data ? fieldEvidenceRates(data.counts) : null;
  return <section className="mt-4 space-y-3 rounded-xl border border-sky-800/60 bg-slate-900/50 p-4" aria-label="Bằng chứng từng trường của bản ghi">
    <h5 className="font-semibold text-white">Giá trị PW1 và PW2 theo từng trường</h5>
    <p className="text-xs leading-5 text-slate-400">Bằng chứng được ghi tại thời điểm migration, chỉ gồm trường trong danh mục QC hiện có. Super Admin xem được giá trị gốc đã lưu; trường không được lưu giá trị gốc sẽ ghi rõ trong bảng. Đây chưa phải xác nhận PW2 hiện tại.</p>
    {loading ? <p role="status" className="text-sm text-slate-300">Đang đọc bằng chứng của bản ghi…</p>
      : error ? <p role="alert" className="text-sm text-rose-300">{error}</p>
      : !data || data.state === 'unavailable' ? <p role="status" className="text-sm text-amber-200">{data?.reason ?? 'Chưa có bằng chứng hợp lệ cho bản ghi.'}</p>
      : <>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span><strong>{count(rates?.total ?? 0)}</strong> lượt trường có bằng chứng QC</span>
          <span><strong>{count(data.counts.match)}</strong> khớp</span>
          <span><strong>{count(data.counts.mismatch + data.counts.missing + data.counts.duplicate)}</strong> có sai lệch</span>
          <span><strong>{count(data.counts.unsupported + data.counts.unverified)}</strong> chưa thể kết luận</span>
        </div>
        {status !== 'all' && <p className="text-xs text-slate-400">Đang xem {count(data.total)} lượt trường ở trạng thái “{statusLabels[status]}”.</p>}
        <p className="text-xs text-slate-400">Snapshot PW1: {data.sourceSnapshotAt ? new Date(data.sourceSnapshotAt).toLocaleString('vi-VN') : 'chưa ghi thời gian'} · Xác minh: {data.verifiedAt ? new Date(data.verifiedAt).toLocaleString('vi-VN') : 'chưa ghi thời gian'}.</p>
        <div className="flex flex-wrap gap-1.5" aria-label="Lọc trạng thái trường của bản ghi">
          {(['all', ...FIELD_STATUSES] as const).map(value => <button key={value} type="button" aria-pressed={status === value}
            onClick={() => { setStatus(value); setPage(1); }}
            className={`rounded-lg px-2.5 py-2 text-xs ${status === value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
            {value === 'all' ? 'Tất cả' : statusLabels[value]}{value !== 'all' ? ` (${data.counts[value]})` : ''}
          </button>)}
        </div>
        {data.rows.some(row => row.targetIdentityMatchesLedger === false) && <p role="alert" className="rounded-lg border border-rose-600/50 bg-rose-950/30 p-2 text-xs text-rose-200">Có field evidence trỏ tới ID PW2 khác mapping ledger. Cần kiểm tra provenance; không dùng dòng này để xác nhận khớp.</p>}
        {data.total === 0 ? <p className="text-sm text-amber-200">{data.reason ?? 'Không có trường ở trạng thái đang lọc.'}</p> : <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs"><caption className="sr-only">Giá trị PW1 và PW2 của bản ghi đã chọn</caption>
            <thead className="bg-slate-950 text-slate-400"><tr>
              {['Trường / bản ghi', 'PW1 gốc', 'PW2 sau migration', 'Kết quả', 'Lý do / quy tắc'].map(label => <th scope="col" className="p-2" key={label}>{label}</th>)}
            </tr></thead><tbody className="divide-y divide-slate-800">{data.rows.map((row, index) => <tr key={`${row.key}-${row.sourceRecord}-${row.elementKey}-${index}`}>
              <td className="p-2"><strong className="text-white">{fieldLabels[row.key] ?? row.key}</strong><span className="block text-slate-500">{row.sourceRecord} · {row.key}{row.elementKey ? ` · ${row.elementKey}` : ''}</span></td>
              <td className="p-2 break-words text-slate-200">{shownValue(row, 'source')}</td>
              <td className="p-2 break-words text-slate-200">{shownValue(row, 'target')}</td>
              <td className="p-2 font-medium text-slate-100">{statusLabels[row.status]}</td>
              <td className="p-2 text-slate-300">{reasonLabels[row.reason] ?? row.reason}<span className="block text-slate-500">{row.targetKey ? `${row.key} → ${row.targetKey}` : row.key} · {row.transform}</span></td>
            </tr>)}</tbody></table>
        </div>}
        {data.total > 100 && <div className="flex items-center gap-3 text-xs">
          <button type="button" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Trang trước</button>
          <span>Trang {page}/{Math.ceil(data.total / 100)} · {count(data.total)} lượt trường</span>
          <button type="button" disabled={page * 100 >= data.total || loading} onClick={() => setPage(value => value + 1)}>Trang sau</button>
        </div>}
      </>}
  </section>;
}
