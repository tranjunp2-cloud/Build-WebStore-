import crypto from "crypto";
import type { Payload } from "payload";

export interface SimulateLocalTestRunOptions {
  dispatchId: string | number;
  targetId: string;
  profile: string;
  runner: string;
  testCaseIds: string[];
  pullRequest?: number;
  commitSha?: string;
  durationMs?: number;
}

/**
 * Executes a simulated local test run in development mode.
 * Safe for serverless and Node.js: uses void async IIFE with full error catching
 * and parallel DB writes to prevent unhandled rejections and N+1 queries.
 */
export function simulateLocalTestRun(
  payload: Payload,
  options: SimulateLocalTestRunOptions,
): void {
  if (process.env.NODE_ENV !== "development") return;

  const devPR = options.pullRequest ?? 0;
  const devSHA = options.commitSha ?? "dev-local-commit-sha";
  const durationMs = options.durationMs ?? 420;

  setTimeout(() => {
    void (async () => {
      try {
        const runId = `local-${options.dispatchId}-${Date.now()}`;
        const digest = crypto.createHash("sha256").update(runId).digest("hex");

        const run = await payload.create({
          collection: "qa_test_runs",
          data: {
            workflowRunId: runId,
            attempt: 1,
            ingestDigest: digest,
            targetId: options.targetId,
            suite: "targeted-smoke",
            profile: options.profile,
            runner:
              options.runner === "vitest" || options.runner === "playwright"
                ? "smoke"
                : (options.runner as any),
            environment: "staging",
            status: "passed",
            pullRequest: devPR,
            commitSha: devSHA,
            startedAt: new Date(Date.now() - 1500).toISOString(),
            finishedAt: new Date().toISOString(),
            summary: {
              passed: options.testCaseIds.length,
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
                suite: "targeted-smoke",
                testCaseId: tcId,
                status: "passed",
                durationMs,
                assertionCode: `ASSERTION_${tcId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_OK`,
                actualSummary: "All assertions passed successfully in local environment.",
                expectedSummary: "Flow executed cleanly within SLA without errors.",
              },
              overrideAccess: true,
            }),
          ),
        );

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
      } catch (err) {
        console.error(
          "[dev-test-runner] Local simulated test execution error:",
          err instanceof Error ? err.message : String(err),
        );
      }
    })();
  }, 1500);
}
