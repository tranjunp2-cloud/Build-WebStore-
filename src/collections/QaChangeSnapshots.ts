import type { CollectionConfig } from "payload";

/** Immutable deploy impact snapshot; values are safe identifiers, not source diffs. */
export const QaChangeSnapshots: CollectionConfig = {
  slug: "qa_change_snapshots",
  admin: {
    useAsTitle: "commitSha",
    defaultColumns: ["pullRequest", "commitSha", "environment", "createdAt"],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    // Deploy snapshots are audit records. Corrections must be represented by a new SHA.
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "pullRequest", type: "number", required: true, index: true },
    { name: "commitSha", type: "text", required: true, index: true },
    {
      name: "environment",
      type: "select",
      required: true,
      options: ["staging", "production"],
    },
    { name: "changedPaths", type: "json", required: true },
    { name: "mappedTargetIds", type: "json", required: true },
    { name: "unmappedPaths", type: "json", required: true },
    { name: "coverageMapVersion", type: "text", required: true },
    { name: "snapshotDigest", type: "text", required: true, index: true },
  ],
  timestamps: true,
};
