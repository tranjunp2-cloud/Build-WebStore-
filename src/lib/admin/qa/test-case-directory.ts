/**
 * Test Case Directory — Master Registry of all 240+ Certified Test Cases (Technical Dev/QC Phrasing)
 */

import rawTestCases from "./test-case-directory.json";

export type TestCaseCategory =
  | "security"
  | "visual"
  | "performance"
  | "resilience"
  | "qa_core";

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
};

export const ALL_TEST_CASES_DIRECTORY: DirectoryTestCase[] = rawTestCases as DirectoryTestCase[];

export function getTestCaseDirectorySummary(testCases = ALL_TEST_CASES_DIRECTORY): TestCaseDirectorySummary {
  const categoryCounts: Record<TestCaseCategory, number> = {
    security: 0,
    visual: 0,
    performance: 0,
    resilience: 0,
    qa_core: 0,
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
