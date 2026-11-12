import crypto from "crypto";
import type { Payload } from "payload";
import type { TargetedSmokePack } from "@/lib/admin/qa/targeted-smoke-registry";
import { withQaTargetedDispatchTransaction } from "@/lib/payload/qa-targeted-dispatch-transaction";

export type TargetedSmokeDispatchRequest = {
  pullRequest: number;
  commitSha: string;
  environment: "staging";
  requestDigest: string;
  profile:
    | "targeted-smoke"
    | "manual-retest"
    | "manual-smoke"
    | "manual-regression"
    | "manual-user_flow"
    | "manual-impact"
    | "manual-security"
    | "manual-all-profiles";
  pack: TargetedSmokePack;
  /** Present only for an explicitly requested manual retest. */
  retestNonce?: string;
  idempotencyKey?: string;
  requestedBy?: string | number;
};

type DispatchRecord = {
  id: string | number;
  requestDigest?: string;
  status?: "queued" | "dispatched" | "cancel_requested" | "cancelled" | "blocked" | "terminal";
  workflowNonce?: string;
};

type LeaseRecord = { id: string | number };

export type TargetedSmokeDispatchOutcome = {
  dispatch: DispatchRecord;
  created: boolean;
  blocked: boolean;
};

export class TargetedSmokeDispatchConflictError extends Error {}

export function targetedSmokeDispatchKey(
  request: Omit<TargetedSmokeDispatchRequest, "requestDigest">,
): string {
  const { pack } = request;
  return [
    request.pullRequest,
    request.commitSha,
    request.environment,
    pack.targetId,
    pack.packId,
    pack.packVersion,
    request.idempotencyKey ?? request.retestNonce ?? "auto",
  ].join(":");
}

/**
 * Creates exactly one durable decision for a pack. Capacity is examined only
 * while its per-fixture transaction lock is held, so two deploy events cannot
 * start two destructive runs against a capacity-one fixture.
 */
export async function claimTargetedSmokeDispatch(
  payload: Payload,
  request: TargetedSmokeDispatchRequest,
  now = new Date(),
  leaseDurationMs = 30 * 60_000,
): Promise<TargetedSmokeDispatchOutcome> {
  if (!Number.isSafeInteger(request.pullRequest) || request.pullRequest < 1)
    throw new Error("pullRequest must be a positive integer");
  if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs < 60_000)
    throw new Error("leaseDurationMs must be at least one minute");

  const dispatchKey = targetedSmokeDispatchKey(request);
  const expiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
  const quotaProfile = request.profile === "manual-regression" ? "regression" : "smoke";
  const quotaLimit = quotaProfile === "regression" ? 1 : 2;

  const hasFixture = Boolean(request.pack.fixtureKey);
  const transactionKey = request.pack.fixtureKey ?? `runner-${request.pack.runner}`;
  return withQaTargetedDispatchTransaction(
    payload,
    request.environment,
    transactionKey,
    async (transactionReq) => {
      const options = { overrideAccess: true, req: transactionReq };
      const existing = await payload.find({
        collection: "qa_smoke_dispatches",
        where: { dispatchKey: { equals: dispatchKey } },
        limit: 1,
        ...options,
      });
      const existingDispatch = existing.docs[0] as DispatchRecord | undefined;
      if (existingDispatch) {
        if (existingDispatch.requestDigest !== request.requestDigest)
          throw new TargetedSmokeDispatchConflictError(
            "Targeted Smoke dispatch already exists with a different request",
          );
        return {
          dispatch: existingDispatch,
          created: false,
          blocked: existingDispatch.status === "blocked",
        };
      }

      const activeForProfile = await payload.find({
        collection: "qa_smoke_dispatches",
        where: {
          and: [
            { environment: { equals: request.environment } },
            {
              profile: {
                in:
                  quotaProfile === "regression"
                    ? ["manual-regression"]
                    : ["targeted-smoke", "manual-retest", "manual-smoke"],
              },
            },
            { status: { in: ["queued", "dispatched", "cancel_requested"] } },
          ],
        },
        limit: quotaLimit,
        ...options,
      });

      const activeLeases = hasFixture
        ? await payload.find({
            collection: "qa_fixture_leases",
            where: {
              and: [
                { environment: { equals: request.environment } },
                { fixtureKey: { equals: request.pack.fixtureKey } },
                { status: { equals: "active" } },
              ],
            },
            limit: 100,
            ...options,
          })
        : { docs: [] as LeaseRecord[] };
      const active: LeaseRecord[] = [];
      for (const lease of activeLeases.docs as LeaseRecord[]) {
        const expires = (lease as LeaseRecord & { expiresAt?: string })
          .expiresAt;
        if (!expires || new Date(expires).getTime() <= now.getTime()) {
          await payload.update({
            collection: "qa_fixture_leases",
            id: lease.id,
            data: { status: "expired" },
            ...options,
          });
        } else {
          active.push(lease);
        }
      }

      const baseData = {
        dispatchKey,
        requestDigest: request.requestDigest,
        workflowNonce: crypto.randomBytes(24).toString("base64url"),
        targetId: request.pack.targetId,
        packId: request.pack.packId,
        packVersion: request.pack.packVersion,
        profile: request.profile,
        runner: request.pack.runner,
        ...(request.pack.fixtureKey ? { fixtureKey: request.pack.fixtureKey } : {}),
        ...(request.pack.fixtureCapacity ? { fixtureCapacity: request.pack.fixtureCapacity } : {}),
        environment: request.environment,
        pullRequest: request.pullRequest,
        commitSha: request.commitSha,
        ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
        ...(request.requestedBy ? { requestedBy: request.requestedBy } : {}),
      };
      if (activeForProfile.docs.length >= quotaLimit) {
        const dispatch = (await payload.create({
          collection: "qa_smoke_dispatches",
          data: {
            ...baseData,
            status: "blocked",
            blockCode: "PROFILE_CAPACITY_EXHAUSTED",
            recoveryHint: `Wait for an active ${quotaProfile} run to finish before retrying.`,
          },
          ...options,
        })) as DispatchRecord;
        return { dispatch, created: true, blocked: true };
      }
      if (hasFixture && active.length >= (request.pack.fixtureCapacity ?? 1)) {
        const dispatch = (await payload.create({
          collection: "qa_smoke_dispatches",
          data: {
            ...baseData,
            status: "blocked",
            blockCode: "FIXTURE_CAPACITY_EXHAUSTED",
            recoveryHint:
              "Wait for the active fixture lease to finish or expire, then trigger a new staging deploy revision.",
          },
          ...options,
        })) as DispatchRecord;
        return { dispatch, created: true, blocked: true };
      }

      const dispatch = (await payload.create({
        collection: "qa_smoke_dispatches",
        data: { ...baseData, status: "queued" },
        ...options,
      })) as DispatchRecord;
      if (hasFixture)
        await payload.create({
          collection: "qa_fixture_leases",
          data: {
            dispatch: dispatch.id,
            environment: request.environment,
            fixtureKey: request.pack.fixtureKey,
            capacitySlot: active.length + 1,
            status: "active",
            acquiredAt: now.toISOString(),
            expiresAt,
          },
          ...options,
        });
      return { dispatch, created: true, blocked: false };
    },
    quotaProfile,
  );
}

/** Compensates a failed external workflow dispatch while holding the same fixture lock. */
export async function blockTargetedSmokeDispatch(
  payload: Payload,
  dispatch: { id: string | number; fixtureKey?: string; runner?: TargetedSmokePack["runner"] },
  code: "GITHUB_DISPATCH_FAILED" | "GITHUB_DISPATCH_UNCONFIRMED",
  recoveryHint: string,
  now = new Date(),
): Promise<void> {
  await withQaTargetedDispatchTransaction(
    payload,
    "staging",
    dispatch.fixtureKey ?? `runner-${dispatch.runner ?? "smoke"}`,
    async (transactionReq) => {
      const options = { overrideAccess: true, req: transactionReq };
      const current = (await payload.findByID({
        collection: "qa_smoke_dispatches",
        id: dispatch.id,
        ...options,
      })) as { status?: string };
      // A known GitHub rejection may happen immediately after the dispatch was
      // created but before it was marked `dispatched`. Both `queued` and
      // `dispatched` are therefore safe to compensate. A terminal ingestion
      // may win the race, and must never be relabelled or have its lease
      // released here.
      if (current.status !== "queued" && current.status !== "dispatched")
        return;
      await payload.update({
        collection: "qa_smoke_dispatches",
        id: dispatch.id,
        data: { status: "blocked", blockCode: code, recoveryHint },
        ...options,
      });
      const activeLeases = await payload.find({
        collection: "qa_fixture_leases",
        where: {
          and: [
            { dispatch: { equals: dispatch.id } },
            { status: { equals: "active" } },
          ],
        },
        limit: 10,
        ...options,
      });
      for (const lease of activeLeases.docs as LeaseRecord[]) {
        await payload.update({
          collection: "qa_fixture_leases",
          id: lease.id,
          data: { status: "released", releasedAt: now.toISOString() },
          ...options,
        });
      }
    },
  );
}

/** Records a non-execution decision when impact has no active registered pack. */
export async function recordTargetedSmokeCoverageGap(
  payload: Payload,
  request: Omit<TargetedSmokeDispatchRequest, "pack"> & { targetId: string },
): Promise<TargetedSmokeDispatchOutcome> {
  const fixtureKey = `coverage-gap-${request.targetId}`;
  const pack: TargetedSmokePack = {
    targetId: request.targetId,
    packId: "coverage-gap",
    packVersion: 1,
    runner: "smoke",
    fixtureKey,
    fixtureCapacity: 1,
    spec: "tests/targeted-smoke/coverage-gap.smoke.spec.ts",
    project: "f40-targeted-smoke",
    testCases: [
      {
        id: "TC-F40-03-COVERAGE-GAP",
        assertion: "No active Smoke pack is registered.",
      },
    ],
  };
  const dispatchKey = targetedSmokeDispatchKey({ ...request, pack });
  return withQaTargetedDispatchTransaction(
    payload,
    request.environment,
    fixtureKey,
    async (transactionReq) => {
      const options = { overrideAccess: true, req: transactionReq };
      const existing = await payload.find({
        collection: "qa_smoke_dispatches",
        where: { dispatchKey: { equals: dispatchKey } },
        limit: 1,
        ...options,
      });
      const dispatch = existing.docs[0] as DispatchRecord | undefined;
      if (dispatch) {
        if (dispatch.requestDigest !== request.requestDigest)
          throw new TargetedSmokeDispatchConflictError(
            "Targeted Smoke coverage gap already exists with a different request",
          );
        return { dispatch, created: false, blocked: true };
      }
      const created = (await payload.create({
        collection: "qa_smoke_dispatches",
        data: {
          dispatchKey,
          requestDigest: request.requestDigest,
          workflowNonce: crypto.randomBytes(24).toString("base64url"),
          targetId: request.targetId,
          packId: pack.packId,
          packVersion: pack.packVersion,
          profile: request.profile,
          fixtureKey,
          fixtureCapacity: pack.fixtureCapacity,
          environment: request.environment,
          pullRequest: request.pullRequest,
          commitSha: request.commitSha,
          status: "blocked",
          blockCode: "NO_ACTIVE_SMOKE_PACK",
          recoveryHint:
            "Create and approve a fixture-backed critical-flow Smoke pack for this target.",
        },
        ...options,
      })) as DispatchRecord;
      return { dispatch: created, created: true, blocked: true };
    },
  );
}
