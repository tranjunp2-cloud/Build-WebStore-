"use client";
import {
  effectiveBlockStatus,
  effectiveFieldStatus,
} from "@/lib/admin/qa/website-migration-status";
import {
  ManualImageReviews,
  ManualImageConfirmation,
  useManualImageReviews,
} from "./ManualImageConfirmation";
import { useState } from "react";
import { imageCheckLabels, type ImageCheckResult } from "./AutomaticImageCheck";
import { FieldEvidence } from "./ImageEvidence";
import { imagePreviews } from "@/lib/admin/qa/website-image-preview";
import type {
  MigrationField,
  MigrationPage,
} from "@/lib/admin/qa/website-migration-data";

export type Detail = {
  storeId: string;
  review: {
    version: string;
    verdict: string | null;
    note: string | null;
    reviewedAt: string | null;
    current: boolean | null;
    checks: Record<string, boolean> | null;
  } | null;
  name: string;
  siteId: number;
  inputHash: string;
  attemptId: string | null;
  committedAt: string | null;
  checkedAt: string | null;
  sourceUrl: string | null;
  url: string;
  pages: MigrationPage[];
  settings: MigrationField[];
  warnings: string[];
  evidence: string;
  migration: string;
  publish: string;
  auditStatus: string;
};
const inputClass =
  "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100";
const labels: Record<string, string> = {
  completed: "Hoàn thành",
  running: "Chưa kết thúc",
  pending: "Chờ xử lý",
  failed: "Lỗi",
  published: "Đã publish",
  draft: "Draft",
  checked: "Đã audit",
  "not-checked": "Chưa kiểm tra",
  "needs-fix": "Có lỗi",
  "needs-review": "Cần review",
  "waiting-be": "Chờ BE",
  match: "Khớp",
  mismatch: "Khác / cần review",
  unverified: "Chưa xác minh",
  stale: "Audit cũ — cần chạy lại",
  historical: "Audit lịch sử — chưa xác minh phiên bản",
};
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-1 text-xs ${["failed", "needs-fix", "mismatch"].includes(value) ? "bg-red-950 text-red-300" : ["completed", "published", "match"].includes(value) ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-300"}`}
    >
      {labels[value] ?? value}
    </span>
  );
}
function BlockStatus({
  block,
  page,
  checks,
}: {
  block: import("@/lib/admin/qa/website-migration-compare").MigrationBlock;
  page: string;
  checks: ImageCheckResult[];
}) {
  const reviews = useManualImageReviews();
  return <Badge value={effectiveBlockStatus(block, page, checks, reviews)} />;
}
function Fields({
  fields,
  imageChecks = [],
  page,
  block,
}: {
  fields: MigrationField[];
  imageChecks?: ImageCheckResult[];
  page?: string;
  block?: string;
}) {
  const reviews = useManualImageReviews();
  return fields.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr>
            <th className="p-2">Field</th>
            <th className="p-2">Nội dung nguồn đã bind</th>
            <th className="p-2">PW2 hiện tại</th>
            <th className="p-2">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={`${f.field}-${i}`} className="border-t border-slate-800">
              <td className="p-2 align-top">{f.field}</td>
              <td className="max-w-md p-2 align-top">
                <FieldEvidence field={f.field} value={f.source} side="PW1" />
              </td>
              <td className="max-w-md p-2 align-top">
                <FieldEvidence field={f.field} value={f.current} side="PW2" />
              </td>
              <td className="p-2 align-top">
                {imagePreviews(f.field, f.source).length ||
                imagePreviews(f.field, f.current).length ? (
                  <div
                    className="space-y-2"
                    aria-label={`Kiểm tra ảnh ${f.field}`}
                  >
                    {imagePreviews(f.field, f.source).map((preview) => {
                      const result = imageChecks.find(
                        (r) =>
                          r.page === page &&
                          r.block === block &&
                          r.field === f.field &&
                          r.path === preview.path,
                      );
                      if (!result)
                        return (
                          <p
                            key={preview.path}
                            className="text-xs text-slate-400"
                          >
                            {preview.path !== "$" ? `${preview.path}: ` : ""}
                            Chưa có kết quả kiểm tra ảnh
                          </p>
                        );
                      const exact = ["same-file", "same-pixels"].includes(
                        result.check.status,
                      );
                      return (
                        <div key={preview.path} className="space-y-1 text-xs">
                          {preview.path !== "$" && (
                            <p className="text-slate-400">{preview.path}</p>
                          )}
                          <ManualImageConfirmation
                            page={page}
                            block={block}
                            field={f.field}
                            path={preview.path}
                          >
                            <span
                              className={`inline-block rounded-md px-2 py-1 ${exact ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-200"}`}
                            >
                              {imageCheckLabels[result.check.status]}
                            </span>
                            {result.altMatches === false && (
                              <p className="text-amber-200">
                                Alt khác — cần review
                              </p>
                            )}
                            {result.dimensionsMatch === false && (
                              <p className="text-amber-200">
                                Kích thước metadata khác — cần review
                              </p>
                            )}
                          </ManualImageConfirmation>
                          <details>
                            <summary className="cursor-pointer text-slate-400">
                              Bằng chứng kiểm tra ảnh
                            </summary>
                            <p>{result.check.detail}</p>
                            <p>
                              {result.checkedAt}
                              {result.cached ? " · cache" : ""}
                            </p>
                            <p className="break-all">
                              SHA-256 PW1: {result.check.sourceHash ?? "—"}
                            </p>
                            <p className="break-all">
                              SHA-256 PW2: {result.check.destinationHash ?? "—"}
                            </p>
                          </details>
                        </div>
                      );
                    })}
                    {imagePreviews(f.field, f.source).some(
                      (p) => p.path !== "$",
                    ) && (
                      <div className="text-xs text-slate-400">
                        Toàn bộ field (gồm text/link):{" "}
                        <Badge
                          value={effectiveFieldStatus(
                            f,
                            page ?? "",
                            block ?? "",
                            imageChecks,
                            reviews,
                          )}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <Badge value={f.status} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="text-sm text-slate-400">
      Chưa có field evidence để đối chiếu.
    </p>
  );
}
function SafeLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href || !/^(https?:\/\/|\/sites\/)/i.test(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-300 underline"
    >
      {children}
    </a>
  );
}
export function WebsiteComparison({ detail }: { detail: Detail }) {
  const [selected, setSelected] = useState(detail.pages[0]?.sourceId ?? ""),
    [width, setWidth] = useState<"desktop" | "mobile">("desktop"),
    [mode, setMode] = useState<"dual" | "swipe">("dual"),
    [split, setSplit] = useState(50);
  const target = detail.pages.find((page) => page.sourceId === selected);
  const frameWidth = width === "mobile" ? 390 : 1440;
  const frameClass = width === "mobile" ? "mx-auto max-w-[390px]" : "w-full";
  const pw1Url = detail.sourceUrl;
  const pw2Url = target?.url ?? null;
  const browserHeader = (
    label: string,
    url: string | null,
    color: "amber" | "sky",
  ) => (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
        color === "amber"
          ? "border-amber-500/30 bg-amber-950/15"
          : "border-sky-500/30 bg-sky-950/15"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex gap-1" aria-hidden="true">
          <i className="size-2 rounded-full bg-rose-400" />
          <i className="size-2 rounded-full bg-amber-300" />
          <i className="size-2 rounded-full bg-emerald-400" />
        </span>
        <span
          className={`truncate text-xs font-bold ${
            color === "amber" ? "text-amber-300" : "text-sky-300"
          }`}
        >
          {label}
        </span>
      </div>
      <SafeLink href={url}>Mở tab mới</SafeLink>
    </div>
  );
  const frame = (
    label: string,
    url: string | null,
    side: "pw1" | "pw2",
  ) => (
    <div className="min-w-0 space-y-2">
      {browserHeader(label, url, side === "pw1" ? "amber" : "sky")}
      <div className="overflow-auto rounded-xl border border-slate-700 bg-white shadow-inner">
        {url && /^(https?:\/\/|\/sites\/)/i.test(url) ? (
          <iframe
            title={label}
            src={url}
            width={frameWidth}
            height={700}
            className={frameClass}
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-[700px] items-center justify-center p-6 text-center text-sm text-slate-600">
            Chưa có URL {side === "pw1" ? "PW1" : "PW2"} đã xác nhận.
          </div>
        )}
      </div>
    </div>
  );
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white">So sánh trực quan PW1 ↔ PW2</h3>
          <p className="mt-1 text-xs text-slate-400">
            Dùng link nguồn đã lưu trong F42; không tự suy diễn URL PW1 tương ứng với trang PW2.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 text-xs">
          <button
            type="button"
            aria-pressed={mode === "dual"}
            onClick={() => setMode("dual")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${mode === "dual" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            Song song
          </button>
          <button
            type="button"
            aria-pressed={mode === "swipe"}
            onClick={() => setMode("swipe")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${mode === "swipe" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            Kéo trượt
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Trang PW2 để so sánh"
          className={inputClass}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {detail.pages.map((page) => (
            <option key={page.sourceId} value={page.sourceId}>
              {page.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Kích thước so sánh"
          className={inputClass}
          value={width}
          onChange={(event) => setWidth(event.target.value as "desktop" | "mobile")}
        >
          <option value="desktop">Desktop 1440px</option>
          <option value="mobile">Mobile 390px</option>
        </select>
        {mode === "swipe" && (
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-300">
            Vị trí: <strong className="text-sky-300">{split}%</strong>
            <input
              aria-label="Vị trí kéo trượt"
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(event) => setSplit(Number(event.target.value))}
              className="w-24 accent-blue-500"
            />
          </label>
        )}
      </div>

      {!pw1Url && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          F42 chưa lưu URL PW1 cho website này, nên chỉ có thể kiểm tra PW2 và evidence dữ liệu.
        </p>
      )}

      {mode === "dual" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {frame("BẢN CŨ PW1 (website nguồn)", pw1Url, "pw1")}
          {frame("BẢN MỚI PW2 (Next.js)", pw2Url, "pw2")}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-4 lg:grid-cols-2">
            {browserHeader("BẢN CŨ PW1 (website nguồn)", pw1Url, "amber")}
            {browserHeader("BẢN MỚI PW2 (Next.js)", pw2Url, "sky")}
          </div>
          <div className="relative h-[704px] overflow-hidden rounded-xl border border-slate-700 bg-white">
            {pw2Url && /^(https?:\/\/|\/sites\/)/i.test(pw2Url) ? (
              <iframe
                title="PW2 so sánh kéo trượt"
                src={pw2Url}
                width={frameWidth}
                height={700}
                className={frameClass}
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div
              className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-amber-400 bg-white"
              style={{ width: `${split}%` }}
            >
              {pw1Url && /^(https?:\/\/|\/sites\/)/i.test(pw1Url) ? (
                <iframe
                  title="PW1 so sánh kéo trượt"
                  src={pw1Url}
                  width={frameWidth}
                  height={700}
                  className={frameClass}
                  sandbox="allow-scripts allow-same-origin"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-600">
                  Chưa có URL PW1 đã xác nhận.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
export function WebsiteMigrationEvidence({
  detail,
  mode = "all",
  imageChecks = [],
}: {
  detail: Detail;
  imageChecks?: ImageCheckResult[];
  mode?: "all" | "content" | "audit";
}) {
  return (
    <ManualImageReviews
      key={detail.review?.version}
      store={detail.storeId}
      version={detail.review?.version ?? ""}
    >
      <p className="break-all text-xs text-slate-400">
        Input hash: {detail.inputHash} · Attempt:{" "}
        {detail.attemptId ?? "Chưa commit"} · Commit:{" "}
        {detail.committedAt ?? "—"}
      </p>
      <div className="flex gap-5 text-sm">
        <SafeLink href={detail.sourceUrl}>Mở nguồn PW1</SafeLink>
        <SafeLink href={detail.url}>Mở PW2</SafeLink>
      </div>
      {mode === "all" && (
        <WebsiteComparison key={detail.storeId} detail={detail} />
      )}
      <p className="text-sm text-amber-200">
        Đối chiếu nội dung đã bind với DB PW2 hiện tại. URL ảnh có thể thay đổi
        sau upload: khác biệt cần review, không tự coi là mất ảnh. Audit kiểm
        tra trang, không chứng minh từng block đã render.
      </p>
      {!detail.pages.length && (
        <p>Chưa có snapshot/mapping để đối chiếu. Không coi là pass.</p>
      )}
      <details>
        <summary className="cursor-pointer">
          Warnings migration ({detail.warnings.length})
        </summary>
        <ul className="list-disc space-y-1 p-4 text-sm text-amber-200">
          {detail.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </details>
      <details>
        <summary className="cursor-pointer">Settings website</summary>
        <Fields fields={detail.settings} />
      </details>
      {detail.pages.map((p) => (
        <article
          key={p.sourceId}
          className="space-y-3 rounded-lg border border-slate-800 p-4"
        >
          <h3 className="font-semibold">
            {p.title} · PW1 #{p.sourceId} → PW2 #{p.destinationId ?? "Chưa map"}{" "}
            <SafeLink href={p.url}>Mở trang</SafeLink>
          </h3>
          {mode !== "audit" && <Fields fields={p.fields} />}
          {mode !== "content" && (
            <>
              <details>
                <summary className="cursor-pointer text-sm text-slate-300">
                  Audit trang
                </summary>
                {p.audit ? (
                  <div className="space-y-2 p-3 text-sm">
                    <Badge value={p.audit.stale ? "stale" : p.audit.status} />
                    <p className="text-slate-400">
                      {p.audit.checkedAt
                        ? new Date(p.audit.checkedAt).toLocaleString()
                        : "Chưa có thời điểm audit"}
                    </p>
                    {!p.audit.versionVerified && (
                      <p className="text-amber-200">
                        Report cũ không lưu phiên bản page; chưa xác nhận report
                        phản ánh dữ liệu hiện tại.
                      </p>
                    )}
                    {p.audit.findings.map((f, i) => (
                      <div key={i} className="rounded bg-slate-900 p-2">
                        <strong>{f.code}</strong> · {f.severity}{" "}
                        {f.viewport ? `· ${f.viewport}px` : ""}
                        <p className="break-all text-slate-300">{f.detail}</p>
                        {f.block && (
                          <p className="text-xs text-slate-400">
                            Block: {f.block}
                          </p>
                        )}
                      </div>
                    ))}
                    {p.audit.status === "checked" &&
                      !p.audit.findings.length && (
                        <p>Không ghi nhận lỗi trong phạm vi audit trang.</p>
                      )}
                  </div>
                ) : (
                  "Chưa có audit được lưu."
                )}
              </details>
            </>
          )}
          {mode !== "audit" &&
            p.blocks.map((b) => (
              <details key={b.sourceId} className="rounded-lg bg-slate-900 p-3">
                <summary className="cursor-pointer text-sm">
                  {b.kind} #{b.sourceId} · block{" "}
                  {b.indexes.join(", ") || "Chưa map"} ·{" "}
                  <BlockStatus
                    block={b}
                    page={p.sourceId}
                    checks={imageChecks}
                  />
                </summary>
                {b.sourceContent?.length > 0 && (
                  <details>
                    <summary>
                      Nội dung PW1 trước generate (đối chiếu thủ công)
                    </summary>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
                      {b.sourceContent
                        .map((f) => `${f.field}: ${f.value}`)
                        .join("\n")}
                    </pre>
                  </details>
                )}
                <Fields
                  fields={b.fields}
                  imageChecks={imageChecks}
                  page={p.sourceId}
                  block={b.sourceId}
                />
              </details>
            ))}
        </article>
      ))}
    </ManualImageReviews>
  );
}
