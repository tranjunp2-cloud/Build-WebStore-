import type { Payload } from "payload";
import {
  calculateProjectHealthSummary,
  calculateTargetHealth,
  type HealthState,
  type ProjectHealthSummary,
  type QaRunInput,
  type TargetHealthResult,
  type ChangeImpactInput,
} from "@/lib/admin/qa/health-calculator";
import { hasApprovedArtifactUrl } from "@/lib/admin/qa/contracts";
import { isApprovedQaEvidenceUrl } from "@/lib/admin/qa/safe-evidence";
import { getAllActiveTargets } from "@/lib/admin/qa/target-registry";
import { resolveTargetedSmokePacks } from "@/lib/admin/qa/targeted-smoke-registry";

const RUN_LIMIT = 500;
// A terminal ingestion payload is capped at 1,000 testcase results. Fetching
// the complete non-pass set for each selected run avoids a global result cap
// silently dropping the precise failed scenario shown in Feature Detail.
const MAX_RESULTS_PER_RUN = 1_000;
export const QA_INBOX_PAGE_SIZE = 25;

type QaResultStatus = "passed" | "failed" | "skipped" | "blocked";
type EvidenceAvailability = "available" | "expired" | "unavailable";

interface QaResultRecord {
  id: string;
  runId: string;
  status: QaResultStatus;
  testCaseId: string;
  assertionCode?: string;
  fixtureReference?: string;
  expectedCount?: number;
  actualCount?: number;
  expectedSummary?: string;
  actualSummary?: string;
  classification?: "product" | "infrastructure" | "flaky" | "blocked";
  evidenceKind?: "screenshot" | "trace" | "report";
  artifactUrl?: string;
  artifactExpiresAt?: string;
  visual?: {
    baselineUrl: string;
    baselineExpiresAt: string;
    currentUrl: string;
    currentExpiresAt: string;
    diffUrl: string;
    diffExpiresAt: string;
    thresholdPercent: number;
    differencePercent: number;
    reviewStatus: "pending_review" | "confirmed_regression" | "expected_change";
  };
}

export interface QaEvidenceLink {
  kind: "screenshot" | "trace" | "report" | "baseline" | "current" | "diff";
  availability: EvidenceAvailability;
  expiresAt?: string;
  url?: string;
}

export interface QaFeatureDetail {
  target: TargetHealthResult;
  run?: Pick<
    QaRunInput,
    "id" | "status" | "finishedAt" | "pullRequest" | "commitSha" | "profile"
  >;
  result?: Omit<
    QaResultRecord,
    "artifactUrl" | "artifactExpiresAt" | "visual"
  > & {
    evidence?: QaEvidenceLink;
    visual?: {
      thresholdPercent: number;
      differencePercent: number;
      reviewStatus:
        | "pending_review"
        | "confirmed_regression"
        | "expected_change";
      evidence: QaEvidenceLink[];
    };
  };
  retest: {
    available: boolean;
    reason?: "NO_ACTIVE_SMOKE_PACK";
    pack?: {
      id: string;
      version: number;
      fixtureKey: string;
      testCaseIds: string[];
    };
  };
}

export interface QaInboxItem {
  target: TargetHealthResult;
  source: "automatic_deploy" | "manual_run" | "deploy_impact" | "github_sync";
  latestEvidence: QaEvidenceLink | { availability: "unavailable" };
  suggestedNextAction: string;
  detail: QaFeatureDetail;
}

export interface QaControlCenterData {
  targets: TargetHealthResult[];
  summary: ProjectHealthSummary;
  inbox: { items: QaInboxItem[]; nextCursor?: string };
  /** Detail data for every active target so Health never fabricates a fallback. */
  detailsByTarget: Record<string, QaFeatureDetail>;
}

function getAllowedArtifactHosts(): string[] {
  const configured = (process.env.QA_ARTIFACT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  // The local-only E2E fixture exercises visual review without talking to an
  // external artifact service. This host is never accepted in deployed envs.
  return process.env.NODE_ENV === "development"
    ? [...configured, "qa-e2e.local"]
    : configured;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function mapRun(doc: Record<string, unknown>): QaRunInput {
  return {
    id: String(doc.id),
    targetId: String(doc.targetId ?? ""),
    status: String(doc.status ?? "") as QaRunInput["status"],
    finishedAt: String(doc.finishedAt ?? ""),
    pullRequest: asNumber(doc.pullRequest),
    commitSha: asString(doc.commitSha),
    profile: asString(doc.profile),
    summary: doc.summary as QaRunInput["summary"],
  };
}

function relationshipId(value: unknown): string {
  if (typeof value === "object" && value && "id" in value)
    return String((value as { id: unknown }).id);
  return String(value ?? "");
}

function mapResult(doc: Record<string, unknown>): QaResultRecord {
  const visualFields = {
    baselineUrl: asString(doc.visualBaselineUrl),
    baselineExpiresAt: asString(doc.visualBaselineExpiresAt),
    currentUrl: asString(doc.visualCurrentUrl),
    currentExpiresAt: asString(doc.visualCurrentExpiresAt),
    diffUrl: asString(doc.visualDiffUrl),
    diffExpiresAt: asString(doc.visualDiffExpiresAt),
    thresholdPercent: asNumber(doc.visualThresholdPercent),
    differencePercent: asNumber(doc.visualDifferencePercent),
    reviewStatus: asString(doc.visualReviewStatus),
  };
  const hasVisual = Object.values(visualFields).every(
    (value) => value !== undefined,
  );
  return {
    id: String(doc.id),
    runId: relationshipId(doc.run),
    status: String(doc.status ?? "skipped") as QaResultStatus,
    testCaseId: String(doc.testCaseId ?? ""),
    assertionCode: asString(doc.assertionCode),
    fixtureReference: asString(doc.fixtureReference),
    expectedCount: asNumber(doc.expectedCount),
    actualCount: asNumber(doc.actualCount),
    expectedSummary: asString(doc.expectedSummary),
    actualSummary: asString(doc.actualSummary),
    classification: asString(
      doc.classification,
    ) as QaResultRecord["classification"],
    evidenceKind: asString(doc.evidenceKind) as QaResultRecord["evidenceKind"],
    artifactUrl: asString(doc.artifactUrl),
    artifactExpiresAt: asString(doc.artifactExpiresAt),
    visual: hasVisual
      ? {
          baselineUrl: visualFields.baselineUrl!,
          baselineExpiresAt: visualFields.baselineExpiresAt!,
          currentUrl: visualFields.currentUrl!,
          currentExpiresAt: visualFields.currentExpiresAt!,
          diffUrl: visualFields.diffUrl!,
          diffExpiresAt: visualFields.diffExpiresAt!,
          thresholdPercent: visualFields.thresholdPercent!,
          differencePercent: visualFields.differencePercent!,
          reviewStatus: visualFields.reviewStatus as NonNullable<
            QaResultRecord["visual"]
          >["reviewStatus"],
        }
      : undefined,
  };
}

function evidenceLink(
  kind: QaEvidenceLink["kind"],
  url?: string,
  expiresAt?: string,
): QaEvidenceLink {
  if (!url || !expiresAt) return { kind, availability: "unavailable" };
  const approved =
    hasApprovedArtifactUrl(url, getAllowedArtifactHosts(), expiresAt) ||
    isApprovedQaEvidenceUrl(
      url,
      expiresAt,
      process.env.QA_EVIDENCE_BASE_URL,
      process.env.QA_INGEST_SECRET,
    );
  return approved
    ? { kind, availability: "available", url, expiresAt }
    : { kind, availability: "expired", expiresAt };
}

function priority(state: HealthState): number {
  return {
    Critical: 0,
    "Needs attention": 1,
    Watch: 2,
    Unknown: 3,
    Healthy: 4,
  }[state];
}

function suggestedNextAction(target: TargetHealthResult): string {
  switch (target.reasonCode) {
    case "LATEST_RUN_FAILED":
      return "Xem evidence của scenario lỗi";
    case "RUN_BLOCKED":
      return "Khắc phục fixture hoặc điều kiện chạy";
    case "CHANGE_IMPACT_UNTESTED":
      return "Kiểm tra smoke pack đã map";
    case "UNMAPPED_TARGET_GAP":
      return "Yêu cầu map target với test pack";
    case "NO_EVIDENCE_RECORDED":
      return "Bổ sung evidence test đáng tin cậy";
    default:
      return "Xem evidence QA gần nhất";
  }
}

function selectRelevantResult(
  target: TargetHealthResult,
  runsById: Map<string, QaRunInput>,
  resultsByRunId: Map<string, QaResultRecord[]>,
): { run?: QaRunInput; result?: QaResultRecord } {
  const targetRuns = [...runsById.values()]
    .filter((run) => run.targetId === target.targetId)
    .sort(
      (left, right) =>
        new Date(right.finishedAt).getTime() -
        new Date(left.finishedAt).getTime(),
    );
  for (const run of targetRuns) {
    const result = (resultsByRunId.get(run.id) ?? []).find(
      (candidate) => candidate.status !== "passed",
    );
    if (result) return { run, result };
  }
  const run = targetRuns[0];
  return { run, result: run ? resultsByRunId.get(run.id)?.[0] : undefined };
}

function detailForTarget(
  target: TargetHealthResult,
  runsById: Map<string, QaRunInput>,
  resultsByRunId: Map<string, QaResultRecord[]>,
): QaFeatureDetail {
  const { run, result } = selectRelevantResult(
    target,
    runsById,
    resultsByRunId,
  );
  const pack = resolveTargetedSmokePacks([target.targetId])[0];
  const evidence = result
    ? evidenceLink(
        result.evidenceKind ?? "report",
        result.artifactUrl,
        result.artifactExpiresAt,
      )
    : undefined;
  return {
    target,
    run: run && {
      id: run.id,
      status: run.status,
      finishedAt: run.finishedAt,
      pullRequest: run.pullRequest,
      commitSha: run.commitSha,
      profile: run.profile,
    },
    result: result && {
      ...result,
      evidence,
      visual: result.visual && {
        thresholdPercent: result.visual.thresholdPercent,
        differencePercent: result.visual.differencePercent,
        reviewStatus: result.visual.reviewStatus,
        evidence: [
          evidenceLink(
            "baseline",
            result.visual.baselineUrl,
            result.visual.baselineExpiresAt,
          ),
          evidenceLink(
            "current",
            result.visual.currentUrl,
            result.visual.currentExpiresAt,
          ),
          evidenceLink(
            "diff",
            result.visual.diffUrl,
            result.visual.diffExpiresAt,
          ),
        ],
      },
    },
    retest: pack
      ? {
          available: true,
          pack: {
            id: pack.packId,
            version: pack.packVersion,
            fixtureKey: pack.fixtureKey,
            testCaseIds: pack.testCases.map((testCase) => testCase.id),
          },
        }
      : { available: false, reason: "NO_ACTIVE_SMOKE_PACK" },
  };
}

export async function getQaControlCenterData(
  payload: Payload,
  options: { cursor?: string } = {},
): Promise<QaControlCenterData> {
  const [runsResult, snapshotsResult] = await Promise.all([
    payload.find({
      collection: "qa_test_runs",
      limit: RUN_LIMIT,
      sort: "-finishedAt",
      depth: 0,
    }),
    payload.find({
      collection: "qa_change_snapshots",
      limit: 100,
      sort: "-createdAt",
      depth: 0,
    }),
  ]);
  const runs = (runsResult.docs as Array<Record<string, unknown>>).map(mapRun);
  const changeImpacts: ChangeImpactInput[] = [];
  for (const doc of snapshotsResult.docs as Array<Record<string, unknown>>) {
    for (const targetId of (doc.mappedTargetIds as string[]) ?? [])
      changeImpacts.push({
        id: doc.id ? String(doc.id) : undefined,
        targetId,
        pullRequest: Number(doc.pullRequest) || 0,
        commitSha: String(doc.commitSha ?? ""),
        createdAt: String(doc.createdAt ?? ""),
      });
  }
  const targets = getAllActiveTargets().map((target) =>
    calculateTargetHealth(target, { runs, changeImpacts }),
  );
  // A target merely lacking a historical run belongs in Project Health, not an
  // endlessly noisy Inbox. Inbox Unknown is specifically the mapping queue.
  const actionable = targets
    .filter(
      (target) =>
        target.state === "Critical" ||
        target.state === "Needs attention" ||
        target.state === "Watch" ||
        target.reasonCode === "UNMAPPED_TARGET_GAP",
    )
    .sort(
      (left, right) =>
        priority(left.state) - priority(right.state) ||
        (right.lastRunAt ?? "").localeCompare(left.lastRunAt ?? "") ||
        left.targetName.localeCompare(right.targetName),
    );
  const relevantRunIds = [
    ...new Set(
      actionable.flatMap((target) =>
        target.links.flatMap((link) => (link.runId ? [link.runId] : [])),
      ),
    ),
  ];
  const resultsResult = relevantRunIds.length
    ? await payload.find({
        collection: "qa_test_results",
        where: {
          and: [
            { run: { in: relevantRunIds } },
            { status: { not_equals: "passed" } },
          ],
        },
        limit: relevantRunIds.length * MAX_RESULTS_PER_RUN,
        sort: "-createdAt",
        depth: 0,
      })
    : { docs: [] };
  const results = (resultsResult.docs as Array<Record<string, unknown>>).map(
    mapResult,
  );
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const resultsByRunId = new Map<string, QaResultRecord[]>();
  for (const result of results) {
    const grouped = resultsByRunId.get(result.runId) ?? [];
    grouped.push(result);
    resultsByRunId.set(result.runId, grouped);
  }
  const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
  const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;
  const page = actionable.slice(safeStart, safeStart + QA_INBOX_PAGE_SIZE);
  const items = page.map((target) => {
    const detail = detailForTarget(target, runsById, resultsByRunId);
    return {
      target,
      source:
        target.reasonCode === "CHANGE_IMPACT_UNTESTED" ||
        target.reasonCode === "UNMAPPED_TARGET_GAP"
          ? ("deploy_impact" as const)
          : detail.run?.profile === "manual-retest"
            ? ("manual_run" as const)
            : ("automatic_deploy" as const),
      latestEvidence: detail.result?.evidence ?? {
        availability: "unavailable" as const,
      },
      suggestedNextAction: suggestedNextAction(target),
      detail,
    };
  });
  const detailsByTarget = Object.fromEntries(
    targets.map((target) => [
      target.targetId,
      detailForTarget(target, runsById, resultsByRunId),
    ]),
  );

  return {
    targets,
    summary: calculateProjectHealthSummary(targets),
    inbox: {
      items,
      nextCursor:
        safeStart + page.length < actionable.length
          ? String(safeStart + page.length)
          : undefined,
    },
    detailsByTarget,
  };
}
