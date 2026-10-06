import {
  compareMigrationContent,
  type MigrationBlock,
  type MigrationField,
} from "./website-migration-compare";
import { imagePreviews } from "./website-image-preview";
import type { ImageCheck } from "./website-image-check";
type Identity = { page: string; block: string; field: string; path: string };
type Check = Identity & {
  check: ImageCheck;
  altMatches: boolean | null;
  dimensionsMatch: boolean | null;
};
const imageKeys = new Set([
  "image",
  "backgroundImage",
  "logo",
  "avatar",
  "posterImage",
  "ogImage",
  "favicon",
]);
function nonImageValue(serialized: string, field: string): unknown {
  const parsed: unknown = JSON.parse(serialized);
  function visit(value: unknown, image = false): unknown {
    if (image) return "[image]";
    if (Array.isArray(value)) return value.map((item) => visit(item));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          visit(item, imageKeys.has(key)),
        ]),
      );
    return value;
  }
  return visit(parsed, imageKeys.has(field.split(".").at(-1) ?? ""));
}
export function effectiveFieldStatus(
  field: MigrationField,
  page: string,
  block: string,
  checks: Check[],
  reviews: Identity[],
): MigrationField["status"] {
  const source = imagePreviews(field.field, field.source),
    current = imagePreviews(field.field, field.current);
  if (!source.length && !current.length) return field.status;
  // Image approval cannot hide missing images, extra slides or altered text/links.
  if (
    source.length !== current.length ||
    source.some((p) => !current.some((c) => c.path === p.path))
  )
    return field.status;
  try {
    if (
      compareMigrationContent(
        { items: nonImageValue(field.source, field.field) },
        { items: nonImageValue(field.current, field.field) },
      )[0].status !== "match"
    )
      return field.status;
  } catch {
    return field.status;
  }
  const statuses = source.map((image) => {
    const sameIdentity = (r: Identity) =>
      r.page === page &&
      r.block === block &&
      r.field === field.field &&
      r.path === image.path;
    if (reviews.some(sameIdentity)) return "match";
    const check = checks.find(sameIdentity);
    if (!check) return "unverified";
    if (check.altMatches === false || check.dimensionsMatch === false)
      return "mismatch";
    if (["same-file", "same-pixels"].includes(check.check.status))
      return "match";
    return check.check.status === "unavailable" ? "unverified" : "mismatch";
  });
  return statuses.includes("mismatch")
    ? "mismatch"
    : statuses.includes("unverified")
      ? "unverified"
      : "match";
}
export function effectiveBlockStatus(
  block: MigrationBlock,
  page: string,
  checks: Check[],
  reviews: Identity[],
): MigrationField["status"] {
  if (!block.indexes.length || !block.fields.length) return block.status;
  const statuses = block.fields.map((field) =>
    effectiveFieldStatus(field, page, block.sourceId, checks, reviews),
  );
  return statuses.includes("mismatch")
    ? "mismatch"
    : statuses.includes("unverified")
      ? "unverified"
      : "match";
}
