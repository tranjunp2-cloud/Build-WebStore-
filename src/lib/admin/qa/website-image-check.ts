import sharp from "sharp";
import { createHash } from "node:crypto";
export type ImageCheck = {
  status: "same-file" | "same-pixels" | "similar" | "different" | "unavailable";
  detail: string;
  sourceHash?: string;
  destinationHash?: string;
  similarity?: number;
};
export async function compareImageBytes(
  source: Buffer,
  destination: Buffer,
): Promise<ImageCheck> {
  const sourceHash = createHash("sha256").update(source).digest("hex"),
    destinationHash = createHash("sha256").update(destination).digest("hex");
  const hashes = { sourceHash, destinationHash };
  const options = { limitInputPixels: 16_000_000 };
  const a = await sharp(source, options).metadata();
  if (sourceHash === destinationHash)
    return {
      status: "same-file",
      detail: "SHA-256 giống nhau: cùng file ảnh.",
      ...hashes,
    };
  const b = await sharp(destination, options).metadata();
  if ((a.pages ?? 1) > 1 || (b.pages ?? 1) > 1)
    return {
      status: "unavailable",
      detail: "Ảnh nhiều frame khác byte; cần kiểm tra animation thủ công.",
      ...hashes,
    };
  if (
    a.width === b.width &&
    a.height === b.height &&
    (a.width ?? 0) * (a.height ?? 0) <= 4_000_000
  ) {
    const [left, right] = await Promise.all([
      sharp(source, options)
        .rotate()
        .toColourspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
      sharp(destination, options)
        .rotate()
        .toColourspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ]);
    if (
      left.info.width === right.info.width &&
      left.info.height === right.info.height &&
      left.data.equals(right.data)
    )
      return {
        status: "same-pixels",
        detail: "File khác byte nhưng toàn bộ pixel giải mã giống nhau.",
        ...hashes,
      };
  }
  const normalize = (bytes: Buffer) =>
    sharp(bytes, options)
      .rotate()
      .toColourspace("srgb")
      .resize(128, 128, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: "#ffffff" })
      .removeAlpha()
      .raw()
      .toBuffer();
  const [left, right] = await Promise.all([
    normalize(source),
    normalize(destination),
  ]);
  let squared = 0;
  for (let i = 0; i < left.length; i++) squared += (left[i] - right[i]) ** 2;
  const similarity =
    Math.round((1 - Math.sqrt(squared / left.length) / 255) * 10000) / 100;
  return {
    status: similarity >= 98 ? "similar" : "different",
    similarity,
    detail:
      similarity >= 98
        ? "Nội dung ảnh có độ tương đồng cao sau chuẩn hoá; chưa tự xác nhận cùng ảnh."
        : "Nội dung ảnh khác theo phép đo pixel; cần review.",
    ...hashes,
  };
}
