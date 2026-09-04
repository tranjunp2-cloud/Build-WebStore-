import crypto from "crypto";
import type { Payload } from "payload";

export type DevTestRunnerType = "unit" | "logic" | "api" | "smoke";

export interface SimulateLocalTestRunOptions {
  dispatchId: string | number;
  targetId: string;
  suite?: string;
  profile: string;
  runner?: DevTestRunnerType | string;
  testCaseIds: string[];
  pullRequest?: number;
  commitSha?: string;
  durationMs?: number;
}

export interface DevRunResult {
  runId: string;
  runDbId: string | number;
  totalTests: number;
}

/**
 * Executes a simulated local test run in development mode.
 * - Explicitly marks environment as "local" and suite as "local-simulation"
 *   to ensure mock data never pollutes staging/production metrics or certifications (C1).
 * - Uses parallel Promise.all to prevent sequential N+1 DB operations.
 * - Type-safe runner mapping without any cast bypass (I3).
 */
export async function executeLocalDevRun(
  payload: Payload,
  options: SimulateLocalTestRunOptions,
): Promise<DevRunResult> {
  const devPR = options.pullRequest ?? 0;
  const devSHA = options.commitSha ?? "dev-local-commit-sha";
  const durationMs = options.durationMs ?? 420;

  const validRunners: readonly DevTestRunnerType[] = ["unit", "logic", "api", "smoke"];
  const runner: DevTestRunnerType = options.runner && (validRunners as readonly string[]).includes(options.runner)
    ? (options.runner as DevTestRunnerType)
    : "smoke";

  const runId = `local-simulation-${options.dispatchId}-${Date.now()}`;
  const digest = crypto.createHash("sha256").update(runId).digest("hex");
  const testCount = options.testCaseIds.length;

  const run = await payload.create({
    collection: "qa_test_runs",
    data: {
      workflowRunId: runId,
      attempt: 1,
      ingestDigest: digest,
      targetId: options.targetId,
      suite: options.suite ?? "local-simulation",
      profile: options.profile,
      runner,
      environment: "local",
      status: "passed",
      pullRequest: devPR,
      commitSha: devSHA,
      startedAt: new Date(Date.now() - 1500).toISOString(),
      finishedAt: new Date().toISOString(),
      summary: {
        passed: testCount,
        failed: 0,
        skipped: 0,
        blocked: 0,
      },
    },
    overrideAccess: true,
  });

  // Parallel DB writes for test results (avoids N+1 sequential writes)
  await Promise.all(
    options.testCaseIds.map((tcId) =>
      payload.create({
        collection: "qa_test_results",
        data: {
          run: run.id,
          suite: options.suite ?? "local-simulation",
          testCaseId: tcId,
          status: "passed",
          durationMs,
          assertionCode: `SIMULATED_${tcId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_DEV`,
          actualSummary: "[LOCAL DEV SIMULATION] Assertion verified cleanly in local development environment.",
          expectedSummary: "[LOCAL DEV SIMULATION] Mock verification for development testing.",
        },
        overrideAccess: true,
      }),
    ),
  );

  if (options.dispatchId) {
    await payload.update({
      collection: "qa_smoke_dispatches",
      id: options.dispatchId,
      data: {
        status: "terminal",
        workflowRunId: runId,
      },
      overrideAccess: true,
    });

    const leases = await payload.find({
      collection: "qa_fixture_leases",
      where: {
        and: [
          { dispatch: { equals: options.dispatchId } },
          { status: { equals: "active" } },
        ],
      },
      limit: 10,
      overrideAccess: true,
    });

    await Promise.all(
      leases.docs.map((lease) =>
        payload.update({
          collection: "qa_fixture_leases",
          id: lease.id,
          data: { status: "released", releasedAt: new Date().toISOString() },
          overrideAccess: true,
        }),
      ),
    );
  }

  return {
    runId,
    runDbId: run.id,
    totalTests: testCount,
  };
}

/**
 * Non-blocking simulation helper for development mode (I1).
 */
export function simulateLocalTestRun(
  payload: Payload,
  options: SimulateLocalTestRunOptions,
): void {
  if (process.env.NODE_ENV !== "development") return;

  setTimeout(() => {
    void (async () => {
      try {
        await executeLocalDevRun(payload, options);
      } catch (err) {
        console.error(
          "[dev-test-runner] Local simulated test execution error:",
          err instanceof Error ? err.message : String(err),
        );
      }
    })();
  }, 1500);
}
