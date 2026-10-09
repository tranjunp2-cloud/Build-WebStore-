"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ImageCheck } from "@/lib/admin/qa/website-image-check";
export type ImageCheckResult = {
  altMatches: boolean | null;
  dimensionsMatch: boolean | null;
  page: string;
  block: string;
  field: string;
  path: string;
  check: ImageCheck;
  cached: boolean;
  checkedAt: string;
};
export const imageCheckLabels = {
  "same-file": "Cùng file ảnh",
  "same-pixels": "Cùng nội dung pixel",
  similar: "Tương đồng cao — cần review",
  different: "Khác ảnh — cần review",
  unavailable: "Không kiểm tra được",
};
export function AutomaticImageCheck({
  store,
  version,
  onResults,
}: {
  store: string;
  version: string;
  onResults: (results: ImageCheckResult[]) => void;
}) {
  const [results, setResults] = useState<ImageCheckResult[]>([]),
    [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [total, setTotal] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    void run(false);
    return () => controller.current?.abort();
  }, [store, version]); // Restart only when the evidence identity changes.
  useEffect(() => {
    onResults(results);
  }, [results, onResults]);
  async function run(force: boolean) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setResults([]);
    setRunning(true);
    setError("");
    setTotal(null);
    try {
      let offset = 0;
      while (!c.signal.aborted) {
        const response = await fetch(
          "/api/admin/qa/website-migrations/images",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ store, version, offset, force }),
            signal: c.signal,
          },
        );
        const body = await response.json();
        if (!response.ok) throw Error(body.error ?? `HTTP ${response.status}`);
        if (c.signal.aborted) return;
        setResults((r) => [...r, ...body.data.results]);
        setTotal(body.data.total);
        if (body.data.done) break;
        if (body.data.nextOffset <= offset)
          throw Error("Không có tiến độ kiểm tra ảnh");
        offset = body.data.nextOffset;
      }
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Không kiểm tra được ảnh");
    } finally {
      if (controller.current === c) {
        setRunning(false);
        if (!c.signal.aborted) window.dispatchEvent(new Event('website-comparison-updated'));
      }
    }
  }
  return (
    <div
      className="flex flex-wrap items-center gap-3 text-xs text-slate-400"
      aria-label="Tiến độ kiểm tra ảnh"
    >
      <span>
        {total === null
          ? running ? "Đang tải kiểm tra ảnh…" : "Chưa có kết quả kiểm tra ảnh"
          : `${results.length}/${total} cặp ảnh${running ? " — đang kiểm tra…" : " — kết quả tại từng field"}`}
      </span>
      <Button
        variant="outline"
        disabled={running}
        onClick={() => void run(true)}
      >
        Kiểm tra lại ảnh
      </Button>
      {running && (
        <Button
          variant="outline"
          onClick={() => {
            controller.current?.abort();
            setRunning(false);
          }}
        >
          Dừng
        </Button>
      )}
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
