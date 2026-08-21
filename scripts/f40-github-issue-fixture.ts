/**
 * Idempotent, QC-only fixture for US-F40-05 browser verification.
 * It touches only the two reserved issue numbers below and never calls GitHub.
 */
import { getPayload } from "payload";
import config from "../src/payload.config";
import { assertQcEnv } from "./qc-guard";

const MAPPING_ISSUE_NUMBER = 94_000_501;
const CLEARED_ISSUE_NUMBER = 94_000_502;
const ADMIN_EMAIL = "f40-e2e-admin@primeweb.local";
const fixtureNumbers = [MAPPING_ISSUE_NUMBER, CLEARED_ISSUE_NUMBER];
const now = () => new Date().toISOString();
const issueUrl = (number: number) => `https://github.com/primeproduction/ech-prime-web-v2/issues/${number}`;

export async function resetF40GithubIssueFixtures(): Promise<void> {
  assertQcEnv();
  const payload = await getPayload({ config });
  await payload.delete({ collection: "qa_github_issues", where: { issueNumber: { in: fixtureNumbers } }, overrideAccess: true });
  const fixtureAdmin = await payload.find({ collection: "users", where: { email: { equals: ADMIN_EMAIL } }, limit: 1, overrideAccess: true });
  const admin = fixtureAdmin.docs[0] as { id: string | number; firstName?: string; lastName?: string } | undefined;
  if (admin && admin.firstName === "F40" && admin.lastName === "E2E Admin")
    await payload.delete({ collection: "users", id: admin.id, overrideAccess: true });
  else if (admin) throw new Error(`Refusing to delete non-fixture user ${ADMIN_EMAIL}`);
  console.log("F40 GitHub issue fixtures removed.");
}

async function seedFixtures(): Promise<void> {
  assertQcEnv();
  const password = process.env.F40_E2E_ADMIN_PASSWORD;
  if (!password || password.length < 12) throw new Error("F40_E2E_ADMIN_PASSWORD must be at least 12 characters");
  const payload = await getPayload({ config });
  await payload.delete({ collection: "qa_github_issues", where: { issueNumber: { in: fixtureNumbers } }, overrideAccess: true });
  const existingAdmin = await payload.find({ collection: "users", where: { email: { equals: ADMIN_EMAIL } }, limit: 1, overrideAccess: true });
  if (existingAdmin.docs.length) throw new Error(`Refusing to overwrite existing fixture admin ${ADMIN_EMAIL}; run reset first`);
  await payload.create({
    collection: "users",
    data: { email: ADMIN_EMAIL, password, firstName: "F40", lastName: "E2E Admin", roles: ["super-admin"] },
    overrideAccess: true,
  });
  const created = await payload.create({
    collection: "qa_github_issues",
    data: {
      issueNumber: MAPPING_ISSUE_NUMBER,
      url: issueUrl(MAPPING_ISSUE_NUMBER),
      title: "[F40 E2E] Unknown P1 mapping fixture",
      state: "open",
      labels: ["P1", "qa-fixture"],
      severity: "P1",
      githubUpdatedAt: now(),
      lastSyncedAt: now(),
      mappingStatus: "unknown",
      mappingHistory: [],
    },
    overrideAccess: true,
  });
  const cleared = await payload.create({
    collection: "qa_github_issues",
    data: {
      issueNumber: CLEARED_ISSUE_NUMBER,
      url: issueUrl(CLEARED_ISSUE_NUMBER),
      title: "[F40 E2E] Remapping fixture",
      state: "open",
      labels: ["P1", "qa-fixture"],
      severity: "P1",
      githubUpdatedAt: now(),
      lastSyncedAt: now(),
      targetId: "identity-login-otp",
      mappingStatus: "confirmed",
      mappingHistory: [{ action: "seeded", targetId: "identity-login-otp", at: now() }],
    },
    overrideAccess: true,
  });
  console.log(`F40_GITHUB_MAPPING_ISSUE_ID=${created.id}`);
  console.log(`F40_E2E_ADMIN_EMAIL=${ADMIN_EMAIL}`);
  console.log(`F40_GITHUB_MAPPING_ISSUE_NUMBER=${MAPPING_ISSUE_NUMBER}`);
  console.log("F40_GITHUB_MAPPING_TARGET_ID=editor-publish-lifecycle");
  console.log(`F40_GITHUB_CLEARED_ISSUE_NUMBER=${CLEARED_ISSUE_NUMBER}`);
  console.log(`F40_GITHUB_CLEARED_ISSUE_ID=${cleared.id}`);
  console.log("F40_GITHUB_CLEARED_TARGET_ID=identity-login-otp");
  console.log("F40_GITHUB_REMAPPED_TARGET_ID=identity-password-recovery");
}

const command = process.argv[2];
if (command === "seed") seedFixtures().catch((error) => { console.error("F40 fixture seed failed", error); process.exit(1); });
else if (command === "reset") resetF40GithubIssueFixtures().catch((error) => { console.error("F40 fixture reset failed", error); process.exit(1); });
else { console.error("Usage: f40-github-issue-fixture.ts <seed|reset>"); process.exit(1); }
