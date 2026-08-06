import crypto from "crypto";
import { z } from "zod";

// Next.js source paths legitimately contain route groups `(dashboard)`, dynamic
// segments `[id]`, and repository filenames with spaces. Keep the allow-list
// narrow so query strings, control characters, and payload text cannot persist.
const SafePath = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9 _./@()[\]-]+$/);
const SafeTargetId = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const safeMachineIdentifier = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);
const AssertionCode = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{0,63}$/);

export const QaRunSummarySchema = z
  .object({
    workflowRunId: safeMachineIdentifier(100),
    attempt: z.number().int().min(1).max(100),
    targetId: SafeTargetId,
    suite: safeMachineIdentifier(120),
    profile: safeMachineIdentifier(120),
    environment: z.enum(["staging", "production", "local"]),
    pullRequest: z.number().int().positive().optional(),
    commitSha: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{7,64}$/i),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    summary: z
      .object({
        passed: z.number().int().min(0),
        failed: z.number().int().min(0),
        skipped: z.number().int().min(0),
        blocked: z.number().int().min(0),
      })
      .strict(),
    results: z
      .array(
        z
          .object({
            testCaseId: z
              .string()
              .trim()
              .min(1)
              .max(160)
              .regex(/^TC-[A-Za-z0-9_.-]+$/),
            status: z.enum(["passed", "failed", "skipped", "blocked"]),
            durationMs: z.number().int().min(0).max(3_600_000).optional(),
            assertionCode: AssertionCode.optional(),
            expectedCount: z.number().int().min(0).max(1_000_000).optional(),
            actualCount: z.number().int().min(0).max(1_000_000).optional(),
            artifactUrl: z.string().url().max(2000).optional(),
            artifactExpiresAt: z.string().datetime().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
    changeSnapshot: z
      .object({
        pullRequest: z.number().int().positive(),
        commitSha: z
          .string()
          .trim()
          .regex(/^[a-f0-9]{7,64}$/i),
        environment: z.enum(["staging", "production"]),
        changedPaths: z.array(SafePath).max(500),
        mappedTargetIds: z.array(SafeTargetId).max(500),
        unmappedPaths: z.array(SafePath).max(500),
        coverageMapVersion: z.string().trim().min(1).max(100),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = new Set<string>();
    for (const result of value.results) {
      const key = result.testCaseId;
      if (keys.has(key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate testCaseId in a summary",
          path: ["results"],
        });
      keys.add(key);
      if (result.artifactUrl && !result.artifactExpiresAt)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "artifactExpiresAt is required with artifactUrl",
          path: ["results"],
        });
      if (result.status !== "passed" && !result.assertionCode)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "assertionCode is required for a non-passed testcase",
          path: ["results"],
        });
    }
    if (
      new Date(value.finishedAt).getTime() < new Date(value.startedAt).getTime()
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "finishedAt must be after startedAt",
        path: ["finishedAt"],
      });
    const counts = { passed: 0, failed: 0, skipped: 0, blocked: 0 };
    for (const result of value.results) counts[result.status] += 1;
    for (const status of Object.keys(counts) as Array<keyof typeof counts>) {
      if (value.summary[status] !== counts[status])
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `summary.${status} must match results`,
          path: ["summary", status],
        });
    }
    if (
      value.changeSnapshot &&
      (value.pullRequest !== value.changeSnapshot.pullRequest ||
        value.commitSha !== value.changeSnapshot.commitSha ||
        value.environment !== value.changeSnapshot.environment)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "changeSnapshot must match run PR/SHA/environment",
        path: ["changeSnapshot"],
      });
  });

export type QaRunSummary = z.infer<typeof QaRunSummarySchema>;

export function verifyQaIngestSignature(
  body: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!signature || !timestamp || !/^\d{10,13}$/.test(timestamp)) return false;
  const timestampMs = Number(
    timestamp.length === 10 ? `${timestamp}000` : timestamp,
  );
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now - timestampMs) > 5 * 60_000
  )
    return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const received = signature.replace(/^sha256=/, "");
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}

export function hasApprovedArtifactUrl(
  url: string,
  allowedHosts: string[],
  expiresAt: string,
  now = Date.now(),
): boolean {
  try {
    const parsed = new URL(url);
    const expiration = new Date(expiresAt).getTime();
    const urlExpiry = parsed.searchParams.get("expiresAt");
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      allowedHosts.includes(parsed.hostname) &&
      // Artifact services must expose a derived metadata record only.
      // Raw trace, screenshot, and video paths are never persisted.
      parsed.pathname.startsWith("/sanitized/") &&
      parsed.search.length <= 80 &&
      urlExpiry === expiresAt &&
      expiration > now &&
      expiration <= now + 7 * 24 * 60 * 60_000
    );
  } catch {
    return false;
  }
}

export function deriveQaRunStatus(
  results: QaRunSummary["results"],
): "passed" | "failed" | "cancelled" | "blocked" {
  if (results.some((result) => result.status === "failed")) return "failed";
  if (results.some((result) => result.status === "blocked")) return "blocked";
  if (results.some((result) => result.status === "passed")) return "passed";
  return "cancelled";
}
