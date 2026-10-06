"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  effectiveBlockStatus,
  effectiveFieldStatus,
} from "@/lib/admin/qa/website-migration-status";
import {
  imagePreviews,
  type ImagePreview,
} from "@/lib/admin/qa/website-image-preview";
import type {
  MigrationBlock,
  MigrationField,
  MigrationPage,
} from "@/lib/admin/qa/website-migration-compare";
import {
  compareMigrationContent,
  text,
} from "@/lib/admin/qa/website-migration-compare";

const names: Record<string, string> = {
  headline: "Tiêu đề",
  subheadline: "Mô tả",
  image: "Ảnh",
  backgroundImage: "Ảnh nền",
  slides: "Danh sách ảnh trượt",
  ctaButtons: "Nút bấm",
  blockType: "Loại khối",
  title: "Tiêu đề",
  content: "Nội dung",
  text: "Nội dung",
  label: "Tên hiển thị",
  url: "Đường dẫn",
  href: "Đường dẫn",
  alt: "Mô tả ảnh",
  banner: "Banner",
  hero: "Banner",
  richText: "Nội dung văn bản",
  products: "Sản phẩm",
};
function label(field: string) {
  const key = field.split(".").at(-1) ?? field;
  return Object.prototype.hasOwnProperty.call(names, key) ? names[key] : key;
}
const structuredFields = new Set([
  "image",
  "backgroundImage",
  "logo",
  "avatar",
  "posterImage",
  "ogImage",
  "favicon",
  "slides",
  "items",
  "projects",
  "ctaButtons",
  "columns",
  "socials",
  "links",
  "menuItems",
  "category",
  "selectedProductIds",
  "filterControls",
]);
const missing = "(missing)";
function parse(value: string, field: string): unknown {
  // text() emits string values unchanged. Only known structured fields are JSON.
  if (!structuredFields.has(field.split(".").at(-1) ?? field)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function empty(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
function ChangedText({ value, other }: { value: string; other: string }) {
  let start = 0;
  while (
    start < value.length &&
    start < other.length &&
    value[start] === other[start]
  )
    start++;
  let end = value.length,
    otherEnd = other.length;
  while (
    end > start &&
    otherEnd > start &&
    value[end - 1] === other[otherEnd - 1]
  ) {
    end--;
    otherEnd--;
  }
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
      {value.slice(0, start)}
      <mark className="rounded bg-amber-300/20 text-amber-100">
        {value.slice(start, end)}
      </mark>
      {value.slice(end)}
    </p>
  );
}
function safeImageUrl(raw: string | null): string | null {
  if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) return null;
  if (/^\/(?!\/)/.test(raw)) {
    try {
      const base = "https://f40-preview.invalid";
      const url = new URL(raw, base);
      return url.origin === base && !url.pathname.startsWith("//")
        ? `${url.pathname}${url.search}${url.hash}`
        : null;
    } catch {
      return null;
    }
  }
  try {
    const url = new URL(raw);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const host = url.hostname.toLowerCase().replace(/\.+$/, "");
    // Remote evidence must not trigger browser requests to arbitrary local services.
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.includes(":") ||
      /^\d+(\.\d+){3}$/.test(host)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
function Thumbnail({ image, side }: { image: ImagePreview; side: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  useEffect(() => {
    setLocalUrl(null);
    if (
      !image.url ||
      /[\u0000-\u0020\u007f\\]/.test(image.url) ||
      !["localhost", "127.0.0.1"].includes(window.location.hostname)
    )
      return;
    try {
      const candidate = new URL(image.url);
      // Local development MinIO only; never allow arbitrary loopback services on staging.
      if (
        candidate.protocol === "http:" &&
        candidate.hostname === window.location.hostname &&
        candidate.port === "9000" &&
        candidate.pathname.startsWith("/primeweb-media/") &&
        !candidate.username &&
        !candidate.password &&
        !candidate.search &&
        !candidate.hash
      )
        setLocalUrl(candidate.href);
    } catch {
      // Invalid URLs remain a visible unsupported preview, not a fetch.
      setLocalUrl(null);
    }
  }, [image.url]);
  const url = safeImageUrl(image.url) ?? localUrl;
  return (
    <figure className="space-y-2">
      {url && !failed ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Phóng to ảnh ${side}`}
          className="relative block h-44 w-full rounded-xl border border-slate-700 bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          <Image
            src={url}
            alt={image.alt || `Ảnh ${side}`}
            fill
            sizes="(max-width: 768px) 90vw, 450px"
            unoptimized
            referrerPolicy="no-referrer"
            className="object-contain"
            onError={() => setFailed(true)}
          />
        </button>
      ) : (
        <p className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-amber-200">
          {failed
            ? "Không tải được ảnh"
            : image.url
              ? "URL ảnh chưa được hỗ trợ xem an toàn (ví dụ ảnh lưu ở máy local)"
              : "Chưa có URL ảnh"}
        </p>
      )}
      <figcaption className="text-xs text-slate-400">
        {image.alt || "Không có mô tả ảnh"}
        {image.width || image.height
          ? ` · ${image.width ?? "?"} × ${image.height ?? "?"} px`
          : ""}
      </figcaption>
      {url && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            overlayClassName="z-[1000002]"
            className="z-[1000003] max-w-5xl bg-slate-950 text-slate-100"
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <DialogTitle>Ảnh · {side}</DialogTitle>
            <DialogDescription>
              {image.alt ||
                "Ảnh từ dữ liệu đối chiếu, không phải ảnh chụp toàn bộ khối."}
            </DialogDescription>
            <div className="relative h-[65vh]">
              {failed ? (
                <p role="status">Không tải được ảnh</p>
              ) : (
                <Image
                  src={url}
                  alt={image.alt || side}
                  fill
                  sizes="90vw"
                  unoptimized
                  referrerPolicy="no-referrer"
                  className="object-contain"
                  onError={() => setFailed(true)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </figure>
  );
}
function Value({
  value,
  other = missing,
  field,
  side,
  depth = 0,
}: {
  value: unknown;
  other?: unknown;
  field: string;
  side: string;
  depth?: number;
}) {
  if (value === undefined || value === "(missing)")
    return <p className="text-sm text-amber-200">Chưa có dữ liệu</p>;
  if (empty(value))
    return <p className="text-sm italic text-slate-400">Không có nội dung</p>;
  if (depth > 5)
    return (
      <p className="text-xs text-slate-400">
        Nội dung nhiều cấp — xem chi tiết kỹ thuật.
      </p>
    );
  const previews = imagePreviews(field, JSON.stringify(value));
  if (previews.length === 1 && previews[0].path === "$")
    return (
      <Thumbnail
        key={previews[0].url ?? "missing"}
        image={previews[0]}
        side={side}
      />
    );
  if (Array.isArray(value))
    return (
      <div className="space-y-3">
        {value.slice(0, 20).map((item, i) => (
          <div key={i} className="rounded-lg border border-slate-700/70 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-400">
              Mục {i + 1}
            </p>
            <Value
              value={item}
              other={
                Array.isArray(other) && i < other.length ? other[i] : missing
              }
              field={field}
              side={side}
              depth={depth + 1}
            />
          </div>
        ))}
        {value.length > 20 && (
          <p className="text-xs text-slate-400">
            Hiển thị 20/{value.length} mục. Xem đầy đủ trong chi tiết kỹ thuật.
          </p>
        )}
      </div>
    );
  if (typeof value === "object" && value)
    return (
      <dl className="space-y-3">
        {Array.from(
          new Set([
            ...Object.keys(value),
            ...(other && typeof other === "object" && !Array.isArray(other)
              ? Object.keys(other)
              : []),
          ]),
        )
          .filter((key) => !["id", "createdAt", "updatedAt"].includes(key))
          .slice(0, 20)
          .map((key) => {
            const record = value as Record<string, unknown>;
            const peer =
              other && typeof other === "object" && !Array.isArray(other)
                ? (other as Record<string, unknown>)
                : {};
            const item = Object.prototype.hasOwnProperty.call(record, key)
              ? record[key]
              : missing;
            const peerItem = Object.prototype.hasOwnProperty.call(peer, key)
              ? peer[key]
              : missing;
            // Canonical comparison treats omitted openInNewTab and false alike.
            if (
              key === "openInNewTab" &&
              (item === false || item === missing) &&
              (peerItem === false || peerItem === missing) &&
              (typeof record.url === "string" || typeof peer.url === "string")
            )
              return null;
            return (
              <div
                key={key}
                className={
                  itemStatus(item, peerItem, key) === "mismatch"
                    ? "rounded-lg border border-rose-500/30 bg-rose-500/5 p-2"
                    : undefined
                }
              >
                <dt className="mb-1 text-xs text-slate-400">{label(key)}</dt>
                <dd>
                  <Value
                    value={item}
                    other={peerItem}
                    field={key}
                    side={side}
                    depth={depth + 1}
                  />
                </dd>
              </div>
            );
          })}
        {Object.keys(value).length > 20 && (
          <p className="text-xs text-slate-400">
            Hiển thị 20 trường đầu. Xem đầy đủ trong chi tiết kỹ thuật.
          </p>
        )}
      </dl>
    );
  if (
    typeof value === "string" &&
    typeof other === "string" &&
    other !== missing &&
    value !== other &&
    !empty(other)
  )
    return <ChangedText value={value} other={other} />;
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
      {String(value)}
    </p>
  );
}
function Status({ status }: { status: MigrationField["status"] }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status === "match" ? "bg-emerald-500/10 text-emerald-300" : status === "mismatch" ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-200"}`}
    >
      {status === "match"
        ? "Khớp dữ liệu đối chiếu"
        : status === "mismatch"
          ? "Dữ liệu khác"
          : "Chưa xác minh"}
    </span>
  );
}
function itemStatus(
  left: unknown,
  right: unknown,
  field: string,
): MigrationField["status"] {
  if (
    left === undefined ||
    right === undefined ||
    left === missing ||
    right === missing
  )
    return "unverified";
  // Reuse the persisted comparator's canonical metadata rules for display only.
  const canonical = compareMigrationContent(
    { items: left },
    { items: right },
  )[0];
  return effectiveFieldStatus(
    { ...canonical, field, source: text(left), current: text(right) },
    "",
    "",
    [],
    [],
  );
}
function FieldComparison({
  field,
  status,
}: {
  field: MigrationField;
  status: MigrationField["status"];
}) {
  const source = parse(field.source, field.field),
    current = parse(field.current, field.field);
  const hasImages =
    imagePreviews(field.field, field.source).length +
      imagePreviews(field.field, field.current).length >
    0;
  const reason =
    status === "match"
      ? "Giá trị khớp dữ liệu đối chiếu F42."
      : hasImages
        ? "Đối chiếu ảnh, thứ tự và nội dung đi kèm. Khác URL chưa đủ kết luận sai ảnh."
        : status === "unverified"
          ? "Chưa đủ bằng chứng để kết luận."
          : empty(source)
            ? "PW2 có thêm nội dung so với dữ liệu đối chiếu."
            : empty(current)
              ? "PW2 thiếu nội dung có trong dữ liệu đối chiếu."
              : "Nội dung PW2 khác dữ liệu đối chiếu — kiểm tra hai giá trị bên dưới.";
  const pair = (
    left: unknown,
    right: unknown,
    key: string,
    pairStatus = status,
  ) => (
    <div key={key} className="grid gap-3 md:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-amber-500/15 bg-slate-950/60 p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-amber-300">
          Kỳ vọng F42
        </p>
        {pairStatus === "mismatch" &&
        typeof left === "string" &&
        typeof right === "string" &&
        !empty(left) &&
        !empty(right) &&
        left !== "(missing)" &&
        right !== "(missing)" &&
        !hasImages ? (
          <ChangedText value={left} other={right} />
        ) : (
          <Value
            value={left}
            other={right}
            field={field.field}
            side="Kỳ vọng F42"
          />
        )}
      </div>
      <div
        className={`min-w-0 rounded-xl border p-4 ${pairStatus === "mismatch" ? "border-rose-500/40 bg-rose-500/5" : "border-sky-500/15 bg-slate-950/60"}`}
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-sky-300">
          PW2 hiện tại
        </p>
        {pairStatus === "mismatch" &&
        typeof left === "string" &&
        typeof right === "string" &&
        !empty(left) &&
        !empty(right) &&
        left !== "(missing)" &&
        right !== "(missing)" &&
        !hasImages ? (
          <ChangedText value={right} other={left} />
        ) : (
          <Value
            value={right}
            other={left}
            field={field.field}
            side="PW2 hiện tại"
          />
        )}
      </div>
    </div>
  );
  return (
    <section className="space-y-3 border-t border-slate-800 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-semibold text-white">
          {label(field.field)}
        </h5>
        <Status status={status} />
      </div>
      <p className="text-xs leading-5 text-slate-400">
        {reason}
        {hasImages && status === "unverified" ? " Chưa xác minh ảnh." : ""}
      </p>
      {Array.isArray(source) && Array.isArray(current) ? (
        <div className="space-y-4">
          {Array.from(
            {
              length: Math.min(
                20,
                Math.max(
                  Array.isArray(source) ? source.length : 0,
                  Array.isArray(current) ? current.length : 0,
                ),
              ),
            },
            (_, i) => (
              <div key={i} className="space-y-2">
                <h6 className="text-xs font-semibold text-slate-300">
                  Mục {i + 1}
                </h6>
                <Status
                  status={itemStatus(
                    i < source.length ? source[i] : undefined,
                    i < current.length ? current[i] : undefined,
                    field.field,
                  )}
                />
                {pair(
                  i < source.length ? source[i] : undefined,
                  i < current.length ? current[i] : undefined,
                  String(i),
                  itemStatus(
                    i < source.length ? source[i] : undefined,
                    i < current.length ? current[i] : undefined,
                    field.field,
                  ),
                )}
              </div>
            ),
          )}
          {Math.max(source.length, current.length) > 20 && (
            <p className="text-xs text-slate-400">
              Hiển thị 20 mục đầu. Xem đầy đủ trong chi tiết kỹ thuật.
            </p>
          )}
          {empty(source) && empty(current) && pair(source, current, "empty")}
        </div>
      ) : (
        pair(source, current, "values")
      )}
    </section>
  );
}
function BlockCard({
  block,
  number,
  page,
}: {
  block: MigrationBlock;
  number: number;
  page: string;
}) {
  const fields = block.fields.map((field) => ({
    field,
    status: effectiveFieldStatus(field, page, block.sourceId, [], []),
  }));
  const attention = fields.filter((item) => item.status !== "match"),
    matching = fields.filter((item) => item.status === "match");
  return (
    <article
      data-testid="migration-block-card"
      data-block-number={number}
      className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/60"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h4 className="font-bold text-white">
            Khối {number} · {label(block.kind)}
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            {attention.length} mục cần kiểm tra · {matching.length} mục khớp
          </p>
        </div>
        <Status status={effectiveBlockStatus(block, page, [], [])} />
      </header>
      {!fields.length && (
        <p className="p-5 text-sm text-amber-200">
          Chưa có dữ liệu trường để đối chiếu khối này.
        </p>
      )}
      {fields.map(({ field, status }, i) => (
        <FieldComparison
          key={`${field.field}-${i}`}
          field={field}
          status={status}
        />
      ))}
      <details className="border-t border-slate-800 p-5">
        <summary className="cursor-pointer text-xs text-slate-400">
          Chi tiết kỹ thuật
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-400">
          {JSON.stringify(block, null, 2)}
        </pre>
      </details>
    </article>
  );
}
export function BlockComparisonPanel({
  page,
  showOnlyErrors,
  onShowOnlyErrorsChange,
}: {
  page?: MigrationPage;
  showOnlyErrors: boolean;
  onShowOnlyErrorsChange: (value: boolean) => void;
}) {
  const blocks = (page?.blocks ?? []).map((block, index) => ({
    block,
    number: index + 1,
  }));
  const visible = blocks.filter(
    ({ block }) =>
      !showOnlyErrors ||
      effectiveBlockStatus(block, page?.sourceId ?? "", [], []) !== "match",
  );
  return (
    <div
      data-testid="migration-block-comparison"
      className="flex-1 overflow-y-auto bg-slate-900/30 p-4 sm:p-6"
    >
      <section
        aria-label="So sánh khối dễ đọc"
        className="mx-auto max-w-6xl space-y-5"
      >
        <header className="rounded-2xl border border-slate-700/70 bg-slate-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-white">
              So sánh nội dung từng khối
            </h3>
            <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
              {[
                { value: true, text: "Cần kiểm tra" },
                { value: false, text: "Tất cả" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.text}
                  aria-pressed={showOnlyErrors === item.value}
                  onClick={() => onShowOnlyErrorsChange(item.value)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold ${showOnlyErrors === item.value ? "bg-blue-600 text-white" : "text-slate-300"}`}
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Đối chiếu dữ liệu kỳ vọng F42 với PW2. Đây không phải ảnh chụp giao
            diện hoặc kết luận toàn bộ website đã migrate đúng.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ảnh hiển thị từ URL dữ liệu; phần này chưa có kết quả kiểm tra ảnh.
            Nội dung PW1 gốc nằm trong Chi tiết kỹ thuật của từng khối.
          </p>
        </header>
        {visible.map(({ block, number }) => (
          <BlockCard
            key={`${page?.sourceId}-${block.sourceId}-${number}`}
            block={block}
            number={number}
            page={page?.sourceId ?? ""}
          />
        ))}
        {!visible.length && (
          <p className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
            {blocks.length
              ? "Không có khối cần kiểm tra trong dữ liệu hiện có."
              : "F42 chưa có dữ liệu khối cho trang này."}
          </p>
        )}
      </section>
    </div>
  );
}
