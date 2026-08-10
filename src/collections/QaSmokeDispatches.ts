import type { CollectionConfig } from "payload";

/**
 * Server-owned ledger for automatic targeted Smoke decisions. Direct writes are
 * denied so a browser cannot create a dispatch or make a blocked run disappear.
 */
export const QaSmokeDispatches: CollectionConfig = {
  slug: "qa_smoke_dispatches",
  admin: {
    useAsTitle: "dispatchKey",
    defaultColumns: ["targetId", "packId", "status", "commitSha", "createdAt"],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "dispatchKey", type: "text", required: true, unique: true, index: true },
    { name: "requestDigest", type: "text", required: true, index: true },
    { name: "workflowNonce", type: "text", required: true, index: true },
    { name: "targetId", type: "text", required: true, index: true },
    { name: "packId", type: "text", required: true, index: true },
    { name: "packVersion", type: "number", required: true, min: 1 },
    { name: "fixtureKey", type: "text", required: true, index: true },
    { name: "fixtureCapacity", type: "number", required: true, min: 1 },
    {
      name: "environment",
      type: "select",
      required: true,
      options: ["staging"],
      index: true,
    },
    { name: "pullRequest", type: "number", required: true, min: 1, index: true },
    { name: "commitSha", type: "text", required: true, index: true },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      options: ["queued", "dispatched", "blocked", "terminal"],
    },
    { name: "blockCode", type: "text" },
    { name: "recoveryHint", type: "text" },
    { name: "workflowRunId", type: "text", index: true },
    { name: "workflowAttempt", type: "number", min: 1 },
    {
      name: "terminalRun",
      type: "relationship",
      relationTo: "qa_test_runs",
    },
  ],
  timestamps: true,
};
