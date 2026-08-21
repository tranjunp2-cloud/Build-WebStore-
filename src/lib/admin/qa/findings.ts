import crypto from "crypto";
import { z } from "zod";
import { hasApprovedArtifactUrl } from "@/lib/admin/qa/contracts";
import { isApprovedQaEvidenceUrl } from "@/lib/admin/qa/safe-evidence";

const SafeTargetId = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const SafeMachineIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);
const TestCaseId = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^TC-[A-Za-z0-9_.-]+$/);
const AssertionCode = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{0,63}$/);

export const QA_FINDING_LIFECYCLES = [
  "needs_review",
  "promoting",
  "github_created",
  "verify_fix",
  "cancelled",
] as const;
export type QaFindingLifecycle = (typeof QA_FINDING_LIFECYCLES)[number];

export const QA_FINDING_PROMOTION_STATES = [
  "not_requested",
  "leased",
  "created",
  "failed",
] as const;
export type QaFindingPromotionState =
  (typeof QA_FINDING_PROMOTION_STATES)[number];

export const QA_FINDING_SEVERITIES = ["P0", "P1", "P2", "P3"] as const;
export type QaFindingSeverity = (typeof QA_FINDING_SEVERITIES)[number];

/** Identity only: volatile IDs, URLs, CI output and timestamps never enter a fingerprint. */
export const QaFindingFingerprintInputSchema = z
  .object({
    targetId: SafeTargetId,
    suite: SafeMachineIdentifier,
    testCaseId: TestCaseId,
    assertionCode: AssertionCode,
  })
  .strict();
export type QaFindingFingerprintInput = z.infer<
  typeof QaFindingFingerprintInputSchema
>;

export const QaFindingLifecycleAuditEntrySchema = z
  .object({
    at: z.string().datetime(),
    from: z.enum(QA_FINDING_LIFECYCLES).nullable(),
    to: z.enum(QA_FINDING_LIFECYCLES),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9_.:-]+$/),
    actorId: z.string().regex(/^\d+$/).optional(),
  })
  .strict();
export type QaFindingLifecycleAuditEntry = z.infer<
  typeof QaFindingLifecycleAuditEntrySchema
>;

export const QaFindingLifecycleTransitionSchema = z
  .object({
    from: z.enum(QA_FINDING_LIFECYCLES),
    to: z.enum(QA_FINDING_LIFECYCLES),
  })
  .strict();

const allowedTransitions: Record<
  QaFindingLifecycle,
  readonly QaFindingLifecycle[]
> = {
  needs_review: ["promoting", "verify_fix", "cancelled"],
  promoting: ["needs_review", "github_created", "verify_fix"],
  github_created: ["verify_fix"],
  verify_fix: ["needs_review"],
  cancelled: ["needs_review"],
};

export function canTransitionQaFinding(
  from: QaFindingLifecycle,
  to: QaFindingLifecycle,
): boolean {
  return allowedTransitions[from].includes(to);
}

/** Active findings deduplicate later failed results until a qualifying pass verifies a fix. */
export function isActiveQaFinding(lifecycle: QaFindingLifecycle): boolean {
  return (
    lifecycle === "needs_review" ||
    lifecycle === "promoting" ||
    lifecycle === "github_created"
  );
}

/** A recurrence never demotes an active promotion; terminal findings reopen for review. */
export function lifecycleForQaFindingFailure(
  lifecycle: QaFindingLifecycle,
): QaFindingLifecycle {
  return isActiveQaFinding(lifecycle) ? lifecycle : "needs_review";
}

/** Only an active finding may be verified by the narrowly-authorized retest flow. */
export function canVerifyQaFinding(lifecycle: QaFindingLifecycle): boolean {
  return isActiveQaFinding(lifecycle);
}

/**
 * Produces a fixed, globally unique database key from stable testcase identity.
 * The explicit v1 prefix permits an intentional future algorithm migration.
 */
export function createQaFindingFingerprint(
  input: QaFindingFingerprintInput,
): string {
  const parsed = QaFindingFingerprintInputSchema.parse(input);
  const canonical = [
    "v1",
    parsed.targetId,
    parsed.suite,
    parsed.testCaseId,
    parsed.assertionCode,
  ].join("\u001f");
  return `qaf_v1_${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

export function assertQaFindingTransition(
  from: QaFindingLifecycle,
  to: QaFindingLifecycle,
): void {
  QaFindingLifecycleTransitionSchema.parse({ from, to });
  if (!canTransitionQaFinding(from, to))
    throw new Error(
      `Invalid QA finding lifecycle transition: ${from} -> ${to}`,
    );
}

export function qaFindingMarker(
  id: string | number,
  fingerprint: string,
): string {
  if (!/^qaf_v1_[a-f0-9]{64}$/.test(fingerprint))
    throw new Error("Invalid QA finding fingerprint");
  return `qa-finding:${id}:${fingerprint}`;
}

/** Re-check persisted evidence before it can leave the internal finding store. */
export function isSafeQaFindingEvidence(
  url: unknown,
  expiresAt: unknown,
): url is string {
  if (typeof url !== "string" || typeof expiresAt !== "string") return false;
  const configuredHosts = (process.env.QA_ARTIFACT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const allowedHosts =
    process.env.NODE_ENV === "development"
      ? [...configuredHosts, "qa-e2e.local"]
      : configuredHosts;
  return (
    hasApprovedArtifactUrl(url, allowedHosts, expiresAt) ||
    isApprovedQaEvidenceUrl(
      url,
      expiresAt,
      process.env.QA_EVIDENCE_BASE_URL,
      process.env.QA_INGEST_SECRET,
    )
  );
}
