import type { CmsTarget } from "./target-registry";

export type HealthState =
  | "Healthy"
  | "Watch"
  | "Needs attention"
  | "Critical"
  | "Unknown";

export type HealthReasonCode =
  | "CONFIRMED_GITHUB_P1_ISSUE"
  | "LATEST_RUN_FAILED"
  | "CHANGE_IMPACT_UNTESTED"
  | "EVIDENCE_STALE"
  | "RUN_BLOCKED"
  | "NO_EVIDENCE_RECORDED"
  | "UNMAPPED_TARGET_GAP"
  | "SMOKE_PASSED"
  | "REGRESSION_PASSED";

export interface HealthExplainableLink {
  label: string;
  url?: string;
  targetId?: string;
  runId?: string;
  issueNumber?: number;
  type: "run" | "finding" | "issue" | "coverage_gap" | "evidence" | "stale_evidence";
}

export interface TargetHealthResult {
  targetId: string;
  targetName: string;
  domain: string;
  type: string;
  coverage: string;
  state: HealthState;
  reasonCode: HealthReasonCode;
  reasonMessage: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  links: HealthExplainableLink[];
}

export interface QaRunInput {
  id: string;
  targetId: string;
  status: "passed" | "failed" | "cancelled" | "blocked";
  finishedAt: string;
  pullRequest?: number;
  commitSha?: string;
  /** Ingestion-owned provenance; does not affect health precedence. */
  profile?: string;
  summary?: {
    passed: number;
    failed: number;
    skipped: number;
    blocked: number;
  };
}

export interface ChangeImpactInput {
  id?: string;
  targetId: string;
  pullRequest: number;
  commitSha: string;
  createdAt: string;
}

/** Only a confirmed, open P1 mirror is allowed to influence target health. */
export interface ConfirmedGithubIssueInput {
  id: string;
  issueNumber: number;
  url: string;
  title: string;
  targetId: string;
  state: "open" | "closed";
  severity: "P1" | "other" | "unknown";
  mappingStatus: "confirmed" | "unknown";
}

export interface CalculateHealthOptions {
  now?: number;
  runs?: QaRunInput[];
  changeImpacts?: ChangeImpactInput[];
  githubIssues?: ConfirmedGithubIssueInput[];
}

const STALE_EVIDENCE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function parseValidTimestamp(value: string): number | undefined {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function hasValidFinishedAt(run: QaRunInput): boolean {
  return parseValidTimestamp(run.finishedAt) !== undefined;
}

function qaRunAdminUrl(runId: string): string {
  return `/admin/collections/qa_test_runs/${encodeURIComponent(runId)}`;
}

function qaChangeSnapshotAdminUrl(snapshotId?: string): string | undefined {
  return snapshotId
    ? `/admin/collections/qa_change_snapshots/${encodeURIComponent(snapshotId)}`
    : undefined;
}

/**
 * Deterministic Health Calculation for a single CMS target based on strict precedence rules:
 * Precedence Order:
 * 1. Critical: confirmed, open P1 GitHub issue.
 * 2. Needs attention: Latest run failed.
 * 3. Watch: Untested change impact, stale evidence (>7 days), or blocked run.
 * 4. Unknown: No valid pack or run result (NO false green).
 * 5. Healthy: Valid recent passing run with no newer failure evidence.
 */
export function calculateTargetHealth(
  target: CmsTarget,
  options: CalculateHealthOptions = {},
): TargetHealthResult {
  const now = options.now ?? Date.now();
  const targetRuns = (options.runs ?? [])
    // Payload documents are mapped from unknown runtime data in the API route.
    // An incomplete timestamp is not valid evidence and must not turn a target green.
    .filter((r) => r.targetId === target.id && hasValidFinishedAt(r))
    .sort(
      (a, b) =>
        new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime(),
    );

  const latestRun = targetRuns[0];

  const latestImpact = (options.changeImpacts ?? [])
    .filter(
      (impact) =>
        impact.targetId === target.id &&
        parseValidTimestamp(impact.createdAt) !== undefined,
    )
    .sort(
      (a, b) =>
        parseValidTimestamp(b.createdAt)! - parseValidTimestamp(a.createdAt)!,
    )[0];

  const hasPendingImpact =
    latestImpact &&
    (!latestRun ||
      Date.parse(latestRun.finishedAt) <= Date.parse(latestImpact.createdAt));

  const links: HealthExplainableLink[] = [];

  const criticalIssues = (options.githubIssues ?? [])
    .filter((issue) => issue.targetId === target.id && issue.mappingStatus === "confirmed" && issue.state === "open" && issue.severity === "P1")
    .sort((a, b) => a.issueNumber - b.issueNumber);
  if (criticalIssues.length > 0) {
    for (const issue of criticalIssues) {
      links.push({
        label: `Open P1 GitHub issue #${issue.issueNumber}: ${issue.title}`,
        url: issue.url,
        targetId: target.id,
        issueNumber: issue.issueNumber,
        type: "issue",
      });
    }
    const [criticalIssue] = criticalIssues;
    return {
      targetId: target.id,
      targetName: target.name,
      domain: target.domain,
      type: target.type,
      coverage: target.coverage,
      state: "Critical",
      reasonCode: "CONFIRMED_GITHUB_P1_ISSUE",
      reasonMessage: `Confirmed open P1 GitHub issue #${criticalIssue.issueNumber} affects this target`,
      lastRunAt: latestRun?.finishedAt,
      lastRunStatus: latestRun?.status,
      links,
    };
  }

  // Precedence Rule 2: NEEDS ATTENTION
  if (latestRun && latestRun.status === "failed") {
    links.push({
      label: `Failed Test Run ${latestRun.id}`,
      url: qaRunAdminUrl(latestRun.id),
      targetId: target.id,
      runId: latestRun.id,
      type: "run",
    });
    return {
      targetId: target.id,
      targetName: target.name,
      domain: target.domain,
      type: target.type,
      coverage: target.coverage,
      state: "Needs attention",
      reasonCode: "LATEST_RUN_FAILED",
      reasonMessage: `Lần chạy test gần nhất thất bại lúc ${new Date(latestRun.finishedAt).toLocaleString("vi-VN")}`,
      lastRunAt: latestRun.finishedAt,
      lastRunStatus: latestRun.status,
      links,
    };
  }

  // Precedence Rule 2: WATCH
  if (latestRun && latestRun.status === "blocked") {
    links.push({
      label: `Blocked Run ${latestRun.id}`,
      url: qaRunAdminUrl(latestRun.id),
      targetId: target.id,
      runId: latestRun.id,
      type: "run",
    });
    return {
      targetId: target.id,
      targetName: target.name,
      domain: target.domain,
      type: target.type,
      coverage: target.coverage,
      state: "Watch",
      reasonCode: "RUN_BLOCKED",
      reasonMessage: "Lần chạy gần nhất bị chặn do thiếu điều kiện hoặc fixture lease",
      lastRunAt: latestRun.finishedAt,
      lastRunStatus: latestRun.status,
      links,
    };
  }

  if (hasPendingImpact) {
    links.push({
      label: `PR #${latestImpact.pullRequest} code change impact`,
      url: qaChangeSnapshotAdminUrl(latestImpact.id),
      targetId: target.id,
      type: "evidence",
    });
    return {
      targetId: target.id,
      targetName: target.name,
      domain: target.domain,
      type: target.type,
      coverage: target.coverage,
      state: "Watch",
      reasonCode: "CHANGE_IMPACT_UNTESTED",
      reasonMessage: `Deploy staging gần đây của PR #${latestImpact.pullRequest} ảnh hưởng target này`,
      lastRunAt: latestRun?.finishedAt,
      lastRunStatus: latestRun?.status,
      links,
    };
  }

  if (latestRun && latestRun.status === "passed") {
    const ageMs = now - new Date(latestRun.finishedAt).getTime();
    if (ageMs > STALE_EVIDENCE_MS) {
      links.push({
        label: `Stale Pass Run ${latestRun.id}`,
        url: qaRunAdminUrl(latestRun.id),
        targetId: target.id,
        runId: latestRun.id,
        type: "stale_evidence",
      });
      return {
        targetId: target.id,
        targetName: target.name,
        domain: target.domain,
        type: target.type,
        coverage: target.coverage,
        state: "Watch",
        reasonCode: "EVIDENCE_STALE",
        reasonMessage: `Evidence test đã quá 7 ngày (${Math.round(ageMs / (24 * 3600 * 1000))} ngày)`,
        lastRunAt: latestRun.finishedAt,
        lastRunStatus: latestRun.status,
        links,
      };
    }
  }

  // Precedence Rule 3: UNKNOWN (NO FALSE GREEN)
  // GIVEN a target has no valid pack or result
  // THEN it is Unknown AND it is never displayed as Healthy merely because no failure is recorded.
  if (!latestRun) {
    links.push({
      label: `Coverage Gap for ${target.id}`,
      url: `/studio/qa#target-${encodeURIComponent(target.id)}`,
      targetId: target.id,
      type: "coverage_gap",
    });
    return {
      targetId: target.id,
      targetName: target.name,
      domain: target.domain,
      type: target.type,
      coverage: target.coverage,
      state: "Unknown",
      reasonCode:
        target.coverage === "unknown"
          ? "UNMAPPED_TARGET_GAP"
          : "NO_EVIDENCE_RECORDED",
      reasonMessage:
        "Chưa có evidence test đáng tin cậy cho target này",
      links,
    };
  }

  // Precedence Rule 4: HEALTHY
  if (latestRun.status === "passed") {
    links.push({
      label: `Passing Run ${latestRun.id}`,
      url: qaRunAdminUrl(latestRun.id),
      targetId: target.id,
      runId: latestRun.id,
      type: "run",
    });
    return {
      targetId: target.id,
      targetName: target.name,
      domain: target.domain,
      type: target.type,
      coverage: target.coverage,
      state: "Healthy",
      reasonCode: "SMOKE_PASSED",
      reasonMessage: "Target có test tự động pass với evidence gần đây",
      lastRunAt: latestRun.finishedAt,
      lastRunStatus: latestRun.status,
      links,
    };
  }

  // Fallback safe state is Unknown (No false green)
  return {
    targetId: target.id,
    targetName: target.name,
    domain: target.domain,
    type: target.type,
    coverage: target.coverage,
    state: "Unknown",
    reasonCode: "NO_EVIDENCE_RECORDED",
    reasonMessage: "Target có evidence chạy test chưa đầy đủ",
    links,
  };
}

export interface ProjectHealthSummary {
  totalTargets: number;
  counts: {
    Healthy: number;
    Watch: number;
    "Needs attention": number;
    Critical: number;
    Unknown: number;
  };
  domainStats: Array<{
    domain: string;
    total: number;
    counts: Record<HealthState, number>;
  }>;
}

export function calculateProjectHealthSummary(
  results: TargetHealthResult[],
): ProjectHealthSummary {
  const counts: ProjectHealthSummary["counts"] = {
    Healthy: 0,
    Watch: 0,
    "Needs attention": 0,
    Critical: 0,
    Unknown: 0,
  };

  const domainMap = new Map<string, Record<HealthState, number>>();

  for (const res of results) {
    counts[res.state] += 1;

    if (!domainMap.has(res.domain)) {
      domainMap.set(res.domain, {
        Healthy: 0,
        Watch: 0,
        "Needs attention": 0,
        Critical: 0,
        Unknown: 0,
      });
    }
    const dCounts = domainMap.get(res.domain)!;
    dCounts[res.state] += 1;
  }

  const domainStats = Array.from(domainMap.entries()).map(
    ([domain, dCounts]) => ({
      domain,
      total: Object.values(dCounts).reduce((a, b) => a + b, 0),
      counts: dCounts,
    }),
  );

  return {
    totalTargets: results.length,
    counts,
    domainStats,
  };
}
