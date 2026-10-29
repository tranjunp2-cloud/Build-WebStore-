'use client';
import { useEffect, useState } from 'react';
import type { DeltaAction, DeltaTracking } from '@/lib/admin/qa/pw1-delta-tracking-reader';

const actionLabels: Record<DeltaAction, string> = { CREATE: 'Tạo mới', UPDATE: 'Cập nhật', RETIRE: 'Ẩn (PW1 đã xóa)', REPORTED: 'Chỉ báo cáo' };
const issueLabels: Record<string, string> = {
  PW2_EDITED_CONFLICT: 'PW2 đã sửa tay — không ghi đè',
  SITE_WEBSITE_GENERATED: 'Website đã generate — không đổi site',
  TARGET_MISSING: 'Bản ghi PW2 không còn',
  PROJECTION_MISSING: 'Thiếu dữ liệu import để đối chiếu',
};
const formatTime = (value: string) => new Date(value).toLocaleString('vi-VN');

/** Delta migration (PW1 changes after the 16/09 snapshot) for one PW1 store; read-only. */
export function DeltaMigrationPanel({ store, refresh }: { store: string; refresh: number }) {
  const [data, setData] = useState<DeltaTracking | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    void (async () => {
      try {
        const response = await fetch(`/api/qa/migration-reconciliation/delta?store_id=${encodeURIComponent(store)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Không tải được dữ liệu delta migration. Bấm làm mới để thử lại.');
        const body = await response.json();
        if (!controller.signal.aborted) setData(body.data);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Không tải được dữ liệu delta migration.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [store, refresh]);

  if (loading) return <p className="mx-5 mt-5 text-sm text-slate-400" role="status">Đang tải delta migration…</p>;
  if (error) return <p className="mx-5 mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100" role="alert">{error}</p>;
  if (!data?.available || (!data.runs.length && !data.changes.length)) {
    return <p className="mx-5 mt-5 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300" data-testid="delta-migration-empty">
      Delta migration: chưa có thay đổi nào sau snapshot 16/09 cho store {store}.
    </p>;
  }
  return (
    <section className="mx-5 mt-5 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200" data-testid="delta-migration-panel">
      <h3 className="mb-3 font-semibold text-slate-100">Delta migration (thay đổi PW1 sau 16/09) — store {store}</h3>
      <div className="space-y-3">
        {data.runs.map((run) => (
          <div key={run.runId} className="rounded-lg border border-slate-700 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-mono text-xs text-slate-400">{run.runId}</span>
              <span>{formatTime(run.startedAt)}</span>
              <span className={run.state === 'APPLIED' ? 'text-emerald-300' : 'text-amber-300'}>{run.state}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {(Object.keys(actionLabels) as DeltaAction[]).filter((action) => run.counts[action] > 0).map((action) => (
                <span key={action} className="rounded bg-slate-800 px-2 py-0.5">{actionLabels[action]}: {run.counts[action]}</span>
              ))}
              {run.issues.length > 0 && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-100">Cần xem tay: {run.issues.length}</span>}
            </div>
            {run.issues.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-amber-100">
                {run.issues.map((issue) => (
                  <li key={`${issue.ref}-${issue.code}`}>{issue.collection} {issue.targetId ?? ''} ({issue.ref}): {issueLabels[issue.code] ?? issue.code}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {data.changes.length > 0 && (
        <table className="mt-4 w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr><th className="py-1">Nguồn PW1</th><th>Bản ghi PW2</th><th>Thao tác gần nhất</th><th>Thời điểm</th></tr>
          </thead>
          <tbody>
            {data.changes.map((change) => (
              <tr key={`${change.sourceEntity}:${change.sourceId}`} className="border-t border-slate-800">
                <td className="py-1 font-mono">{change.sourceEntity}:{change.sourceId}</td>
                <td className="font-mono">{change.targetCollection}/{change.targetId}</td>
                <td>{actionLabels[change.action]}</td>
                <td>{formatTime(change.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.changesTruncated && <p className="mt-2 text-xs text-slate-400">Chỉ hiển thị 500 thay đổi gần nhất.</p>}
    </section>
  );
}
