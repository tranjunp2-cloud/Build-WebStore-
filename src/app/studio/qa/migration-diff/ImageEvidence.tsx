"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  imagePreviews,
  type ImagePreview,
} from "@/lib/admin/qa/website-image-preview";

function EvidenceImage({ image, side }: { image: ImagePreview; side: string }) {
  const [failed, setFailed] = useState(false),
    [open, setOpen] = useState(false);
  return (
    <figure className="space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-3">
      <figcaption className="text-xs text-slate-400">
        {image.path === "$" ? "Ảnh" : image.path.replace(/^\$\.?/, "")} · {side}
      </figcaption>
      {image.url && !failed ? (
        <button
          type="button"
          className="relative block h-40 w-full min-w-48 rounded bg-slate-900"
          aria-label={`Phóng to ảnh ${side} ${image.path}`}
          onClick={() => setOpen(true)}
        >
          <Image
            src={image.url}
            alt={image.alt || `Ảnh ${side}`}
            fill
            sizes="320px"
            unoptimized
            className="object-contain"
            onError={() => setFailed(true)}
          />
        </button>
      ) : (
        <p
          role="status"
          className="flex h-40 items-center justify-center text-sm text-amber-200"
        >
          {failed ? "Không tải được ảnh" : "Chưa có URL ảnh"}
        </p>
      )}
      <p className="text-xs">Alt: {image.alt || "(trống)"}</p>
      <p className="text-xs text-slate-400">
        {image.width ?? "—"} × {image.height ?? "—"} px
      </p>
      {image.url && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-5xl bg-slate-950 text-slate-100">
            <DialogTitle>Ảnh {side}</DialogTitle>
            <DialogDescription>
              {image.alt || "Xem ảnh gốc để đối chiếu trực quan"}
            </DialogDescription>
            <div className="relative h-[65vh]">
              <Image
                src={image.url}
                alt={image.alt || `Ảnh ${side}`}
                fill
                sizes="90vw"
                unoptimized
                className="object-contain"
              />
            </div>
            <a
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan-300 underline"
            >
              Mở ảnh gốc
            </a>
          </DialogContent>
        </Dialog>
      )}
    </figure>
  );
}
export function FieldEvidence({
  field,
  value,
  side,
}: {
  field: string;
  value: string;
  side: "PW1" | "PW2";
}) {
  const images = imagePreviews(field, value);
  const technical = (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">
      {value}
    </pre>
  );
  return images.length ? (
    <div className="min-w-56 space-y-3">
      {images.map((image) => (
        <EvidenceImage
          key={`${image.path}:${image.url}`}
          image={image}
          side={side}
        />
      ))}
      <details>
        <summary className="cursor-pointer text-xs text-slate-400">
          Chi tiết dữ liệu
        </summary>
        {technical}
      </details>
    </div>
  ) : (
    technical
  );
}
