export type MigrationField = {
  field: string;
  source: string;
  current: string;
  status: "match" | "mismatch" | "unverified";
};
export type MigrationBlock = {
  sourceId: string;
  kind: string;
  indexes: number[];
  sourceContent: Array<{ field: string; value: string }>;
  fields: MigrationField[];
  status: "match" | "mismatch" | "unverified";
};
export type MigrationAudit = {
  status: string;
  stale: boolean;
  versionVerified: boolean;
  checkedAt: string | null;
  findings: Array<{
    code: string;
    severity: string;
    detail: string;
    block?: string;
    viewport?: number;
  }>;
};
export type MigrationPage = {
  sourceId: string;
  title: string;
  destinationId: number | null;
  url: string | null;
  fields: MigrationField[];
  blocks: MigrationBlock[];
  audit: MigrationAudit | null;
};
export type MigrationStore = {
  fieldEvidence?: import('./field-evidence-summary').FieldEvidenceSummary | null;
  storeId: string;
  name: string;
  siteId: number | null;
  migration: string;
  publish: string | null;
  canCompare?: boolean;
  auditStatus: string;
  errors: number;
  warnings: number;
  checkedAt: string | null;
  url: string | null;
  updatedAt: string;
  pageCount: number;
  qcStatus: "passed" | "warning" | "failed" | "unverified";
  reviewedAt: string | null;
};
type RecordValue = Record<string, unknown>;
export const asRecord = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
export const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
export const text = (value: unknown): string =>
  value === undefined
    ? "(missing)"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
const fieldsToCheck = new Set([
  "headline",
  "subheadline",
  "html",
  "ctaButtons",
  "slides",
  "items",
  "projects",
  "category",
  "selectionMode",
  "selectedProductIds",
  "includeOutOfStock",
  "showCategoryFilter",
  "filterControls",
  "limit",
  "videoUrl",
  "logo",
  "tagline",
  "columns",
  "socials",
  "links",
  "menuItems",
  "image",
  "title",
  "description",
  "copyright",
  "logoText",
  "copyrightText",
  "showCart",
  "showOrderTracking",
]);
/** Only source-bound content is compared. AI typography, colors and variants are not parity requirements. */
export function compareMigrationContent(
  expected: unknown,
  actual: unknown,
  prefix = "",
): MigrationField[] {
  const source = asRecord(expected),
    current = asRecord(actual);
  return Object.keys(source)
    .filter((key) => fieldsToCheck.has(key))
    .map((key) => {
      const left = source[key],
        right = current[key];
      // Media uploads may replace source URLs with Payload relationship IDs.
      // A changed URL is evidence for review, never automatically certified equivalent.
      // Optional empty socials render no links. A missing block is still unverified.
      const emptySocials =
        key === "socials" &&
        Array.isArray(left) &&
        left.length === 0 &&
        (right === undefined || right === null) &&
        Object.keys(current).length > 0;
      const equal =
        emptySocials ||
        (right !== undefined && canonical(left) === canonical(right));
      return {
        field: prefix + key,
        source: text(left),
        current: text(right),
        status: equal
          ? "match"
          : right === undefined
            ? "unverified"
            : "mismatch",
      };
    });
}
function canonical(value: unknown): string {
  if (Array.isArray(value))
    return JSON.stringify(value.map((item) => JSON.parse(canonical(item))));
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(asRecord(value))
          .filter(([key, item]) => {
            if (["id", "createdAt", "updatedAt"].includes(key)) return false;
            // Link renderers treat an omitted target flag as opening in the same tab.
            if (
              key === "openInNewTab" &&
              item === false &&
              typeof asRecord(value).url === "string"
            )
              return false;
            return true;
          })
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, JSON.parse(canonical(item))]),
      ),
    );
  return JSON.stringify(value ?? null);
}
