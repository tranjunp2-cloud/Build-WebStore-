import type { CollectionConfig } from "payload";

/** Immutable CI execution envelope. Writes are restricted to signed ingestion. */
export const QaTestRuns: CollectionConfig = {
  slug: "qa_test_runs",
  admin: {
    useAsTitle: "workflowRunId",
    defaultColumns: [
      "workflowRunId",
      "attempt",
      "targetId",
      "status",
      "finishedAt",
    ],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "workflowRunId", type: "text", required: true, index: true },
    { name: "attempt", type: "number", required: true, min: 1 },
    {
      name: "ingestDigest",
      type: "text",
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: "targetId", type: "text", required: true, index: true },
    { name: "suite", type: "text", required: true, index: true },
    { name: "profile", type: "text", required: true },
    {
      name: "runner",
      type: "select",
      required: true,
      defaultValue: "smoke",
      options: ["unit", "logic", "api", "smoke"],
      index: true,
    },
    {
      name: "environment",
      type: "select",
      required: true,
      options: ["staging", "production", "local"],
    },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      options: ["passed", "failed", "cancelled", "blocked"],
    },
    { name: "pullRequest", type: "number", index: true },
    { name: "commitSha", type: "text", required: true, index: true },
    { name: "startedAt", type: "date", required: true },
    { name: "finishedAt", type: "date", required: true },
    {
      name: "summary",
      type: "group",
      fields: [
        { name: "passed", type: "number", required: true, min: 0 },
        { name: "failed", type: "number", required: true, min: 0 },
        { name: "skipped", type: "number", required: true, min: 0 },
        { name: "blocked", type: "number", required: true, min: 0 },
      ],
    },
  ],
  timestamps: true,
};
