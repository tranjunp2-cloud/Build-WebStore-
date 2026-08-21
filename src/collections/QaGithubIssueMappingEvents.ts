import type { CollectionConfig } from "payload";

/** Immutable audit log for every privileged GitHub issue mapping decision. */
export const QaGithubIssueMappingEvents: CollectionConfig = {
  slug: "qa_github_issue_mapping_events",
  admin: { useAsTitle: "action", defaultColumns: ["githubIssue", "action", "targetId", "occurredAt"] },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "githubIssue", type: "relationship", relationTo: "qa_github_issues", required: true, index: true },
    { name: "action", type: "select", required: true, options: ["confirmed", "dismissed"] },
    { name: "targetId", type: "text" },
    { name: "reason", type: "textarea", maxLength: 500 },
    { name: "actor", type: "relationship", relationTo: "users", required: true },
    { name: "occurredAt", type: "date", required: true, index: true },
  ],
  timestamps: true,
};
