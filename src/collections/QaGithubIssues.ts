import type { CollectionConfig } from "payload";

/**
 * Sanitized GitHub issue mirror. GitHub remains authoritative for issue bodies
 * and comments; only metadata necessary to explain QA health is persisted.
 */
export const QaGithubIssues: CollectionConfig = {
  slug: "qa_github_issues",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["issueNumber", "state", "severity", "mappingStatus", "githubUpdatedAt"],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "issueNumber", type: "number", required: true, unique: true, index: true },
    { name: "url", type: "text", required: true },
    { name: "title", type: "text", required: true },
    { name: "state", type: "select", required: true, index: true, options: ["open", "closed"] },
    { name: "labels", type: "json", required: true },
    { name: "severity", type: "select", required: true, index: true, options: ["P1", "other", "unknown"] },
    { name: "githubUpdatedAt", type: "date", required: true, index: true },
    { name: "lastSyncedAt", type: "date", required: true },
    { name: "targetId", type: "text", index: true },
    { name: "mappingStatus", type: "select", required: true, index: true, options: ["unknown", "confirmed", "dismissed"] },
    { name: "mappingDismissReason", type: "textarea", maxLength: 500, admin: { readOnly: true } },
    { name: "suggestedTargetId", type: "text", admin: { readOnly: true } },
    { name: "mappingConfirmedAt", type: "date", admin: { readOnly: true } },
    { name: "mappingConfirmedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "mappingHistory", type: "json", required: true, defaultValue: [] , admin: { readOnly: true } },
  ],
  timestamps: true,
};
