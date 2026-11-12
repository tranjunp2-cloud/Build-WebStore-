"use client";
import { useStudioCan } from "../../_components/studio-permissions-context";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ManualImageReview } from "@/lib/admin/qa/website-image-review";
const Context = createContext<{
  reviews: ManualImageReview[];
  save: (
    identity: { page: string; block: string; field: string; path: string },
    confirmed: boolean,
  ) => Promise<void>;
} | null>(null);
export function useManualImageReviews() {
  return useContext(Context)?.reviews ?? [];
}
export function ManualImageReviews({
  store,
  version,
  children,
}: {
  store: string;
  version: string;
  children: React.ReactNode;
}) {
  const [reviews, setReviews] = useState<ManualImageReview[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setReviews([]);
    fetch(
      `/api/admin/qa/website-migrations/images?${new URLSearchParams({ store, version })}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.error);
        setReviews(body.data);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Không đọc được xác nhận ảnh",
          );
      });
    return () => controller.abort();
  }, [store, version]);
  async function save(
    identity: { page: string; block: string; field: string; path: string },
    confirmed: boolean,
  ) {
    const response = await fetch("/api/admin/qa/website-migrations/images", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store, version, ...identity, confirmed }),
    });
    const body = await response.json();
    if (!response.ok) throw Error(body.error);
    setReviews(body.data);
  }
  return (
    <Context.Provider value={{ reviews, save }}>
      {error && (
        <p role="alert" className="text-amber-200">
          {error}
        </p>
      )}
      {children}
    </Context.Provider>
  );
}
export function ManualImageConfirmation({
  page,
  block,
  field,
  path,
  children,
}: {
  page?: string;
  block?: string;
  field: string;
  path: string;
  children?: React.ReactNode;
}) {
  const context = useContext(Context);
  const canConfirm = useStudioCan()("migration.review");
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  if (!context || !page || !block) return <>{children}</>;
  const review = context.reviews.find(
    (r) =>
      r.page === page &&
      r.block === block &&
      r.field === field &&
      r.path === path,
  );
  return (
    <div className="space-y-1">
      {review ? (
        <>
          <span className="inline-block rounded-md bg-emerald-950 px-2 py-1 text-emerald-300">
            Khớp — xác nhận thủ công
          </span>
          <p className="text-slate-400">
            Reviewer #{review.reviewerId} ·{" "}
            {new Date(review.reviewedAt).toLocaleString()}
          </p>
        </>
      ) : (
        children
      )}
      {review && (
        <details>
          <summary className="cursor-pointer text-slate-400">
            Kết quả tự động trước xác nhận
          </summary>
          {children}
        </details>
      )}
      {canConfirm && <Button
        variant="outline"
        size="sm"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError("");
          try {
            await context.save({ page, block, field, path }, !review);
            window.dispatchEvent(new Event('website-comparison-updated'));
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Không lưu được xác nhận",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving
          ? "Đang lưu…"
          : review
            ? "Huỷ xác nhận ảnh"
            : "Xác nhận thủ công: ảnh đúng"}
      </Button>}
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
