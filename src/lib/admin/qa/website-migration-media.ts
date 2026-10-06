import { asRecord } from "./website-migration-compare";

const mediaFields = new Set([
  "image",
  "backgroundImage",
  "logo",
  "avatar",
  "posterImage",
  "ogImage",
  "favicon",
]);
function mediaId(value: unknown): number | undefined {
  const candidate =
    typeof value === "object" && value ? asRecord(value).id : value;
  return typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate > 0
    ? candidate
    : typeof candidate === "string" && /^\d+$/.test(candidate)
      ? Number(candidate)
      : undefined;
}
export function collectWebsiteMediaIds(value: unknown): number[] {
  const ids = new Set<number>();
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, item] of Object.entries(asRecord(value))) {
      const id = mediaFields.has(key) ? mediaId(item) : undefined;
      if (id !== undefined) ids.add(id);
      else if (item && typeof item === "object") visit(item);
    }
  }
  visit(value);
  return [...ids];
}
/** Only public image metadata; never serialize owner, tenant or private provenance fields. */
export function websiteMediaData(value: unknown) {
  const record = asRecord(value);
  return Object.fromEntries(
    ["id", "url", "alt", "filename", "mimeType", "filesize", "width", "height"]
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, record[key]]),
  );
}
export function resolveWebsiteMedia(
  value: unknown,
  media: ReadonlyMap<number, unknown>,
): unknown {
  if (Array.isArray(value))
    return value.map((item) => resolveWebsiteMedia(item, media));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, item]) => {
      const id = mediaFields.has(key) ? mediaId(item) : undefined;
      return [
        key,
        id !== undefined
          ? media.has(id)
            ? websiteMediaData(media.get(id))
            : { id, unavailable: true }
          : resolveWebsiteMedia(item, media),
      ];
    }),
  );
}
