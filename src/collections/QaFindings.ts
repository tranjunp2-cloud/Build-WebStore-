import type { CollectionConfig } from "payload";
import {
  QA_FINDING_LIFECYCLES,
  QA_FINDING_PROMOTION_STATES,
  QA_FINDING_SEVERITIES,
} from "@/lib/admin/qa/findings";

/**
 * Durable internal defect record. Test ingestion and promotion APIs are the only
 * writers; the Payload admin is deliberately a super-admin read-only surface.
 */
export const QaFindings: CollectionConfig = {
  slug: "qa_findings",
  admin: {
    useAsTitle: "fingerprint",
    defaultColumns: ["targetId", "testCaseId", "severity", "lifecycle", "updatedAt"],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "fingerprint", type: "text", required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: "targetId", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "suite", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "testCaseId", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "assertionCode", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "expectedCount", type: "number", min: 0, admin: { readOnly: true } },
    { name: "actualCount", type: "number", min: 0, admin: { readOnly: true } },
    { name: "severity", type: "select", required: true, index: true, options: [...QA_FINDING_SEVERITIES], admin: { readOnly: true } },
    { name: "lifecycle", type: "select", required: true, index: true, options: [...QA_FINDING_LIFECYCLES], admin: { readOnly: true } },
    { name: "owner", type: "text", required: true, index: true, admin: { readOnly: true, description: "Target registry team responsible for this finding." } },
    { name: "latestRun", type: "relationship", relationTo: "qa_test_runs", required: true, index: true, admin: { readOnly: true } },
    { name: "latestResult", type: "relationship", relationTo: "qa_test_results", required: true, index: true, admin: { readOnly: true } },
    { name: "latestEvidenceExpiresAt", type: "date", admin: { readOnly: true, description: "Expiry of the result's approved signed evidence, when present." } },
    { name: "promotionState", type: "select", required: true, index: true, options: [...QA_FINDING_PROMOTION_STATES], defaultValue: "not_requested", admin: { readOnly: true } },
    { name: "promotionLeaseExpiresAt", type: "date", admin: { readOnly: true } },
    { name: "githubIssue", type: "relationship", relationTo: "qa_github_issues", index: true, admin: { readOnly: true } },
    { name: "githubMarker", type: "text", unique: true, admin: { readOnly: true, description: "Deterministic marker used only for idempotent GitHub promotion." } },
    { name: "verifiedAt", type: "date", admin: { readOnly: true } },
    { name: "lifecycleAudit", type: "json", required: true, defaultValue: [], admin: { readOnly: true, description: "Bounded, safe server-written lifecycle audit. No CI output or artifact URLs." } },
  ],
  timestamps: true,
};
