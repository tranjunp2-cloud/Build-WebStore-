import type { CollectionConfig } from "payload";
import { hasApprovedArtifactUrl } from "@/lib/admin/qa/contracts";

function getAllowedArtifactHosts(): string[] {
  return (process.env.QA_ARTIFACT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/** One structured, sanitized terminal result per run, suite and TC-ID. */
export const QaTestResults: CollectionConfig = {
  slug: "qa_test_results",
  admin: {
    useAsTitle: "testCaseId",
    defaultColumns: ["testCaseId", "suite", "status", "run", "durationMs"],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "run",
      type: "relationship",
      relationTo: "qa_test_runs",
      required: true,
      index: true,
    },
    { name: "suite", type: "text", required: true, index: true },
    { name: "testCaseId", type: "text", required: true, index: true },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      options: ["passed", "failed", "skipped", "blocked"],
    },
    { name: "durationMs", type: "number", min: 0 },
    {
      name: "assertionCode",
      type: "text",
      admin: { description: "Safe machine-readable assertion code only." },
    },
    { name: "expectedCount", type: "number", min: 0 },
    { name: "actualCount", type: "number", min: 0 },
    {
      name: "artifactUrl",
      type: "text",
      validate: (
        value: unknown,
        { siblingData }: { siblingData: Record<string, unknown> },
      ) => {
        if (!value) return true;
        const expiresAt = siblingData?.artifactExpiresAt;
        if (typeof value !== "string" || typeof expiresAt !== "string")
          return "A signed artifact URL needs an expiry.";
        return (
          hasApprovedArtifactUrl(value, getAllowedArtifactHosts(), expiresAt) ||
          "Artifact URL must be from an approved host and expire within seven days."
        );
      },
      admin: {
        description:
          "Approved signed URL only; never raw traces, screenshots, or video.",
      },
    },
    { name: "artifactExpiresAt", type: "date" },
  ],
  timestamps: true,
};
