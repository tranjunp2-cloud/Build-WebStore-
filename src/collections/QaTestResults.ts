import type { CollectionConfig } from "payload";
import { hasApprovedArtifactUrl } from "@/lib/admin/qa/contracts";
import { verifyQaEvidenceLink } from "@/lib/admin/qa/safe-evidence";

function getAllowedArtifactHosts(): string[] {
  return (process.env.QA_ARTIFACT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isGeneratedEvidenceUrl(value: string, expiresAt: string): boolean {
  const baseUrl = process.env.QA_EVIDENCE_BASE_URL;
  const secret = process.env.QA_INGEST_SECRET;
  if (!baseUrl || !secret) return false;
  try {
    const url = new URL(value);
    const expected = new URL(baseUrl);
    const match = url.pathname.match(/^\/api\/admin\/qa\/evidence\/(\d+)$/);
    return (
      url.origin === expected.origin &&
      Boolean(match) &&
      url.searchParams.get("expiresAt") === expiresAt &&
      verifyQaEvidenceLink(match![1], expiresAt, url.searchParams.get("signature"), secret)
    );
  } catch {
    return false;
  }
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
      name: "fixtureReference",
      type: "text",
      admin: { description: "Stable, non-secret QC fixture identifier only." },
    },
    {
      name: "expectedSummary",
      type: "text",
      admin: { description: "Bounded safe expectation summary; never raw CI output." },
    },
    {
      name: "actualSummary",
      type: "text",
      admin: { description: "Bounded safe actual summary; never raw CI output." },
    },
    {
      name: "classification",
      type: "select",
      options: ["product", "infrastructure", "flaky", "blocked"],
    },
    {
      name: "evidenceKind",
      type: "select",
      options: ["screenshot", "trace", "report"],
    },
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
          isGeneratedEvidenceUrl(value, expiresAt) ||
          "Artifact URL must be from an approved host and expire within seven days."
        );
      },
      admin: {
        description:
          "Approved signed URL only; never raw traces, screenshots, or video.",
      },
    },
    { name: "artifactExpiresAt", type: "date" },
    {
      name: "visualBaselineUrl",
      type: "text",
      admin: { description: "Approved expiring sanitized visual baseline URL only." },
    },
    { name: "visualBaselineExpiresAt", type: "date" },
    {
      name: "visualCurrentUrl",
      type: "text",
      admin: { description: "Approved expiring sanitized visual current URL only." },
    },
    { name: "visualCurrentExpiresAt", type: "date" },
    {
      name: "visualDiffUrl",
      type: "text",
      admin: { description: "Approved expiring sanitized visual diff URL only." },
    },
    { name: "visualDiffExpiresAt", type: "date" },
    { name: "visualThresholdPercent", type: "number", min: 0, max: 100 },
    { name: "visualDifferencePercent", type: "number", min: 0, max: 100 },
    {
      name: "visualReviewStatus",
      type: "select",
      options: ["pending_review", "confirmed_regression", "expected_change"],
      admin: { description: "Tester review state. It never creates a GitHub issue." },
    },
    {
      name: "visualReviewedBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
    { name: "visualReviewedAt", type: "date", admin: { readOnly: true } },
  ],
  timestamps: true,
};
