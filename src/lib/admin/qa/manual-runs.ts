import crypto from "crypto";
import type { Payload, Where } from "payload";
import { getTargetById } from "@/lib/admin/qa/target-registry";
import { getTargetQaCoverage } from "@/lib/admin/qa/targeted-qa-coverage";
import {
  getManualQaProfileAvailability,
  resolveManualQaPack,
  type ManualQaProfile,
} from "@/lib/admin/qa/targeted-smoke-registry";

const SHA = /^[a-f0-9]{7,64}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/;

export type ManualRunContext = { pullRequest: number; commitSha: string };
export type ManualRunPreflight = {
  canDispatch: boolean;
  reasons: Array<{ code: string; recovery: string }>;
  availableProfiles: Record<ManualQaProfile, boolean>;
  environment: "staging";
  target?: {
    id: string;
    name: string;
    type: string;
    certification: {
      state: string;
      owner: string;
      recovery: string;
      allowedProfiles: readonly string[];
    };
  };
  pack?: {
    id: string;
    version: number;
    testType: string;
    testCases: Array<{ id: string; assertion: string }>;
    prerequisites: readonly string[];
    fixtureKey?: string;
    estimatedDurationMinutes: number;
    manualChecklistCount: number;
  };
  context?: ManualRunContext;
};

export function parseManualRunContext(input: {
  pullRequest?: unknown;
  commitSha?: unknown;
}): ManualRunContext | undefined {
  if (input.pullRequest === undefined && input.commitSha === undefined)
    return undefined;
  if (
    !Number.isSafeInteger(input.pullRequest) ||
    (input.pullRequest as number) < 1 ||
    typeof input.commitSha !== "string" ||
    !SHA.test(input.commitSha)
  )
    throw new Error("PR and immutable SHA must be supplied together");
  return {
    pullRequest: input.pullRequest as number,
    commitSha: input.commitSha,
  };
}

export function validateManualIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value))
    throw new Error("Invalid idempotency key");
  return value;
}

async function resolvedStagingContext(
  payload: Payload,
  requested?: ManualRunContext,
): Promise<ManualRunContext | undefined> {
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA;

  if (
    requested &&
    currentSha &&
    !currentSha.toLowerCase().startsWith(requested.commitSha.toLowerCase()) &&
    !requested.commitSha.toLowerCase().startsWith(currentSha.toLowerCase())
  )
    return undefined;

  const where: Where | undefined = requested
    ? {
        and: [
          { pullRequest: { equals: requested.pullRequest } },
          { environment: { equals: "staging" } },
        ],
      }
    : currentSha
      ? {
          and: [
            { commitSha: { equals: currentSha } },
            { environment: { equals: "staging" } },
          ],
        }
      : undefined;

  if (where) {
    const result = await payload.find({
      collection: "qa_test_runs",
      where,
      sort: "-finishedAt",
      limit: 20,
      depth: 0,
      overrideAccess: true,
    });

    const matchingRun = result.docs.find((doc) => {
      const run = doc as { pullRequest?: unknown; commitSha?: unknown };
      const pullRequest = run?.pullRequest;
      const commitSha = run?.commitSha;
      if (!Number.isSafeInteger(pullRequest) || typeof commitSha !== "string")
        return false;
      if (requested) {
        if (pullRequest !== requested.pullRequest) return false;
        const rSha = requested.commitSha.toLowerCase();
        const dSha = commitSha.toLowerCase();
        return rSha === dSha || dSha.startsWith(rSha) || rSha.startsWith(dSha);
      }
      return true;
    }) as { pullRequest?: unknown; commitSha?: unknown } | undefined;

    if (matchingRun) {
      const pullRequest = matchingRun.pullRequest;
      const commitSha = matchingRun.commitSha;
      if (Number.isSafeInteger(pullRequest) && typeof commitSha === "string") {
        return {
          pullRequest: pullRequest as number,
          commitSha: commitSha as string,
        };
      }
    }
  }

  // Fallback 1: If user explicitly requested PR and SHA, verify against deployment SHA or development mode
  if (requested) {
    if (currentSha) {
      const cSha = currentSha.toLowerCase();
      const rSha = requested.commitSha.toLowerCase();
      if (cSha === rSha || cSha.startsWith(rSha) || rSha.startsWith(cSha)) {
        return {
          pullRequest: requested.pullRequest,
          commitSha: requested.commitSha,
        };
      }
      return undefined;
    }
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      return {
        pullRequest: requested.pullRequest,
        commitSha: requested.commitSha,
      };
    }
    return undefined;
  }

  // Fallback 2: In development environment, supply local test context
  if (process.env.NODE_ENV === "development") {
    return {
      pullRequest: 0,
      commitSha: currentSha || "dev-local-commit-sha",
    };
  }

  return undefined;
}

export async function getManualRunPreflight(
  payload: Payload,
  input: {
    targetId: string;
    profile: ManualQaProfile;
    context?: ManualRunContext;
  },
): Promise<ManualRunPreflight> {
  const target = getTargetById(input.targetId);
  const certification = target ? getTargetQaCoverage(target.id) : undefined;
  const availableProfiles = target?.active
    ? getManualQaProfileAvailability(target.id)
    : { smoke: false, regression: false, user_flow: false, impact: false, security: false };
  const reasons: ManualRunPreflight["reasons"] = [];
  if (!target || !target.active)
    reasons.push({
      code: "TARGET_INACTIVE",
      recovery: "Choose an active QA target.",
    });
  const resolved =
    target && target.active
      ? resolveManualQaPack(target.id, input.profile)
      : undefined;
  if (!resolved)
    reasons.push({
      code: "NO_ACTIVE_PACK",
      recovery:
        certification?.recovery ??
        "Choose a profile with an approved target-specific pack.",
    });
  const context = await resolvedStagingContext(payload, input.context);
  if (!context)
    reasons.push({
      code: "STAGING_CONTEXT_UNAVAILABLE",
      recovery: "Use the currently deployed Staging (QC) PR and SHA.",
    });
  if (resolved?.pack.fixtureKey) {
    const active = await payload.find({
      collection: "qa_fixture_leases",
      where: {
        and: [
          { environment: { equals: "staging" } },
          { fixtureKey: { equals: resolved.pack.fixtureKey } },
          { status: { equals: "active" } },
        ],
      },
      limit: resolved.pack.fixtureCapacity ?? 1,
      depth: 0,
      overrideAccess: true,
    });
    const now = Date.now();
    const unexpired = active.docs.filter((lease) => {
      const expiresAt = (lease as { expiresAt?: unknown }).expiresAt;
      return typeof expiresAt === "string" && Date.parse(expiresAt) > now;
    });
    if (unexpired.length >= (resolved.pack.fixtureCapacity ?? 1))
      reasons.push({
        code: "FIXTURE_CAPACITY_EXHAUSTED",
        recovery: "Wait for the fixture lease to finish or expire.",
      });
  }
  const profileValues =
    input.profile === "regression"
      ? ["manual-regression"]
      : ["targeted-smoke", "manual-retest", "manual-smoke"];
  const profileLimit = input.profile === "regression" ? 1 : 2;
  const profileRuns = await payload.find({
    collection: "qa_smoke_dispatches",
    where: {
      and: [
        { environment: { equals: "staging" } },
        { profile: { in: profileValues } },
        { status: { in: ["queued", "dispatched", "cancel_requested"] } },
      ],
    },
    limit: profileLimit,
    depth: 0,
    overrideAccess: true,
  });
  if (profileRuns.docs.length >= profileLimit)
    reasons.push({
      code: "PROFILE_CAPACITY_EXHAUSTED",
      recovery: `Wait for an active ${input.profile} run to finish.`,
    });
  return {
    canDispatch: reasons.length === 0,
    reasons,
    availableProfiles,
    environment: "staging",
    target: target
      ? {
          id: target.id,
          name: target.name,
          type: target.type,
          certification: {
            state: certification?.certificationState ?? "no-certified-pack",
            owner: certification?.owner ?? "qa-unassigned",
            recovery:
              certification?.recovery ??
              "QA approval is required before this target can run.",
            allowedProfiles: certification?.allowedProfiles ?? [],
          },
        }
      : undefined,
    pack: resolved
      ? {
          id: resolved.pack.packId,
          version: resolved.pack.packVersion,
          testType: resolved.profile.testType,
          testCases: [...resolved.profile.testCases],
          prerequisites: resolved.profile.prerequisites,
          fixtureKey: resolved.pack.fixtureKey,
          estimatedDurationMinutes: resolved.profile.estimatedDurationMinutes,
          manualChecklistCount: resolved.profile.manualChecklistCount,
        }
      : undefined,
    context,
  };
}

export function manualRunRequestDigest(input: {
  targetId: string;
  profile: ManualQaProfile;
  context: ManualRunContext;
  idempotencyKey: string;
  requestedBy: string | number;
}): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}
