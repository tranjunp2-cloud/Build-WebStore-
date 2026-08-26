"use client";

/** Controlled Studio failure state for the server-side QA read model. */
export default function QaControlCenterError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error;
  return (
    <section
      role="alert"
      className="rounded-[var(--radius)] border border-[var(--danger)] bg-[var(--bg-elev)] p-6 text-[var(--text)]"
    >
      <h1 className="text-xl font-bold">Không thể tải QA Control Center</h1>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Dữ liệu QA chưa sẵn sàng. Trạng thái hệ thống không được suy luận là
        pass.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-11 rounded-[var(--radius)] border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)]"
      >
        Thử tải lại
      </button>
    </section>
  );
}
