/**
 * Test Case Directory — Master Registry of all 240+ Certified Test Cases (Technical Dev/QC Phrasing)
 */

import rawTestCases from "./test-case-directory.json";

export type TestCaseCategory =
  | "security"
  | "visual"
  | "performance"
  | "resilience"
  | "qa_core"
  | "user_flow"
  | "impact";

export interface DirectoryTestCase {
  id: string;
  name: string;
  domain: string;
  category: TestCaseCategory;
  categoryLabel: string;
  targetId?: string;
  targetName?: string;
  specFile: string;
  runner: "vitest" | "playwright";
  assertion: string;
  durationEstimateMinutes: number;
  certificationState: "certified_executable" | "pending";
}

export interface TestCaseDirectorySummary {
  totalCount: number;
  categoryCounts: Record<TestCaseCategory, number>;
  domainCounts: Record<string, number>;
  testCases: DirectoryTestCase[];
}

export const CATEGORY_LABELS: Record<TestCaseCategory, { label: string; icon: string; color: string }> = {
  security: { label: "Security & IDOR Isolation", icon: "shield", color: "#ef4444" },
  visual: { label: "Visual & Contract Matrix (67 Targets)", icon: "layout", color: "#3b82f6" },
  performance: { label: "Performance & N+1 Budget", icon: "zap", color: "#f59e0b" },
  resilience: { label: "Idempotency & Anti-Drift", icon: "credit-card", color: "#10b981" },
  qa_core: { label: "QA Engine & Staging CI", icon: "settings", color: "#71717a" },
  user_flow: { label: "User Flows & E2E Logic", icon: "git-branch", color: "#8b5cf6" },
  impact: { label: "Functional & Change Impact", icon: "crosshair", color: "#ec4899" },
};

export const ALL_TEST_CASES_DIRECTORY: DirectoryTestCase[] = rawTestCases as DirectoryTestCase[];

export function getTestCaseDirectorySummary(testCases = ALL_TEST_CASES_DIRECTORY): TestCaseDirectorySummary {
  const categoryCounts: Record<TestCaseCategory, number> = {
    security: 0,
    visual: 0,
    performance: 0,
    resilience: 0,
    qa_core: 0,
    user_flow: 0,
    impact: 0,
  };
  const domainCounts: Record<string, number> = {};

  for (const tc of testCases) {
    categoryCounts[tc.category] = (categoryCounts[tc.category] || 0) + 1;
    domainCounts[tc.domain] = (domainCounts[tc.domain] || 0) + 1;
  }

  return {
    totalCount: testCases.length,
    categoryCounts,
    domainCounts,
    testCases,
  };
}

const testCasesByTargetMap: Record<string, DirectoryTestCase[]> = {};
for (const tc of ALL_TEST_CASES_DIRECTORY) {
  if (tc.targetId) {
    if (!testCasesByTargetMap[tc.targetId]) testCasesByTargetMap[tc.targetId] = [];
    testCasesByTargetMap[tc.targetId].push(tc);
  }
}

export function getTestCasesForTarget(targetId: string): DirectoryTestCase[] {
  return testCasesByTargetMap[targetId] ?? [];
}

export function getTestCaseIdsForTarget(targetId: string): string[] {
  return (testCasesByTargetMap[targetId] ?? []).map((tc) => tc.id);
}

export interface TargetCaseDirectoryItem {
  id: string;
  assertion: string;
}

export const TARGET_CASE_IDS_MAP: Record<string, string[]> = {};
export const TARGET_USER_FLOW_IDS_MAP: Record<string, string[]> = {};
export const TARGET_IMPACT_IDS_MAP: Record<string, string[]> = {};
export const TARGET_SECURITY_IDS_MAP: Record<string, string[]> = {};

export const TARGET_TEST_CASES_MAP: Record<string, TargetCaseDirectoryItem[]> = {};
export const TARGET_USER_FLOW_CASES_MAP: Record<string, TargetCaseDirectoryItem[]> = {};
export const TARGET_IMPACT_CASES_MAP: Record<string, TargetCaseDirectoryItem[]> = {};
export const TARGET_SECURITY_CASES_MAP: Record<string, TargetCaseDirectoryItem[]> = {};

for (const tc of ALL_TEST_CASES_DIRECTORY) {
  if (tc.targetId) {
    const item: TargetCaseDirectoryItem = {
      id: tc.id,
      assertion: tc.assertion || tc.name || "Contract verified.",
    };

    if (!TARGET_CASE_IDS_MAP[tc.targetId]) TARGET_CASE_IDS_MAP[tc.targetId] = [];
    TARGET_CASE_IDS_MAP[tc.targetId].push(tc.id);

    if (!TARGET_TEST_CASES_MAP[tc.targetId]) TARGET_TEST_CASES_MAP[tc.targetId] = [];
    TARGET_TEST_CASES_MAP[tc.targetId].push(item);

    if (tc.category === "user_flow") {
      if (!TARGET_USER_FLOW_IDS_MAP[tc.targetId]) TARGET_USER_FLOW_IDS_MAP[tc.targetId] = [];
      TARGET_USER_FLOW_IDS_MAP[tc.targetId].push(tc.id);

      if (!TARGET_USER_FLOW_CASES_MAP[tc.targetId]) TARGET_USER_FLOW_CASES_MAP[tc.targetId] = [];
      TARGET_USER_FLOW_CASES_MAP[tc.targetId].push(item);
    }
    if (tc.category === "impact") {
      if (!TARGET_IMPACT_IDS_MAP[tc.targetId]) TARGET_IMPACT_IDS_MAP[tc.targetId] = [];
      TARGET_IMPACT_IDS_MAP[tc.targetId].push(tc.id);

      if (!TARGET_IMPACT_CASES_MAP[tc.targetId]) TARGET_IMPACT_CASES_MAP[tc.targetId] = [];
      TARGET_IMPACT_CASES_MAP[tc.targetId].push(item);
    }
    if (tc.category === "security") {
      if (!TARGET_SECURITY_IDS_MAP[tc.targetId]) TARGET_SECURITY_IDS_MAP[tc.targetId] = [];
      TARGET_SECURITY_IDS_MAP[tc.targetId].push(tc.id);

      if (!TARGET_SECURITY_CASES_MAP[tc.targetId]) TARGET_SECURITY_CASES_MAP[tc.targetId] = [];
      TARGET_SECURITY_CASES_MAP[tc.targetId].push(item);
    }
  }
}

export { testCasesByTargetMap };
