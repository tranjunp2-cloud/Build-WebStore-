/**
 * Checked-in allow-list for US-F40-03. A deploy can select a pack from this
 * registry, but it can never supply a project, spec, shell command, or test
 * identifier of its own.
 */
export type TargetedSmokeTestCase = {
  id: string;
  assertion: string;
};

/** Browser clients choose one of these labels, never a spec or command. */
export type ManualQaProfile = "smoke" | "regression";

export type TargetedQaPackProfile = {
  testType: "e2e" | "api" | "unit";
  estimatedDurationMinutes: number;
  prerequisites: readonly string[];
  manualChecklistCount: number;
  testCases: readonly TargetedSmokeTestCase[];
};

export type TargetedSmokePack = {
  targetId: string;
  packId: string;
  packVersion: number;
  fixtureKey: string;
  fixtureCapacity: number;
  spec: string;
  project: string;
  testCases: readonly TargetedSmokeTestCase[];
  /** Only checked-in profile contracts are executable. Missing Regression blocks preflight. */
  manualProfiles?: Partial<Record<ManualQaProfile, TargetedQaPackProfile>>;
};

const TEST_CASE_ID = /^TC-[A-Za-z0-9_.-]+$/;
const MACHINE_ID = /^[a-z][a-z0-9-]*$/;
const PLAYWRIGHT_PROJECT = /^[a-z][a-z0-9-]*$/;
const TARGETED_SPEC_PREFIX = "tests/targeted-smoke/";

export const TARGETED_SMOKE_PACKS: readonly TargetedSmokePack[] = [
  {
    targetId: "editor-productgrid-variants",
    packId: "editor-product-grid-variants-smoke",
    packVersion: 1,
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    spec: "tests/targeted-smoke/editor-product-grid-variants.smoke.spec.ts",
    project: "f40-targeted-smoke",
    testCases: [{ id: "TC-F40-04-02", assertion: "QA-Tshirt-SML exposes S, M and L exactly once." }],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 4,
        prerequisites: ["QA-Tshirt-SML fixture is resettable", "Desktop Chromium is available"],
        manualChecklistCount: 0,
        testCases: [{ id: "TC-F40-04-02", assertion: "QA-Tshirt-SML exposes S, M and L exactly once." }],
      },
    },
  },
  {
    targetId: "products-variants-inventory",
    packId: "product-variants-critical-flow",
    packVersion: 1,
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    spec: "tests/targeted-smoke/product-variants.smoke.spec.ts",
    project: "f40-targeted-smoke",
    testCases: [
      {
        id: "TC-F09.64",
        assertion:
          "A variant product cannot be added before selection; after selecting an in-stock variant, the cart records that variant.",
      },
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 5,
        prerequisites: ["Dedicated targeted Smoke tenant is available"],
        manualChecklistCount: 0,
        testCases: [{ id: "TC-F09.64", assertion: "A variant product cannot be added before selection; after selecting an in-stock variant, the cart records that variant." }],
      },
    },
  },
  {
    targetId: "order-payment-verification",
    packId: "order-payment-verification-critical-flow",
    packVersion: 1,
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    spec: "tests/targeted-smoke/order-payment-verification.smoke.spec.ts",
    project: "f40-targeted-smoke",
    testCases: [
      {
        id: "TC-F10-06-41",
        assertion:
          "A staged bank-transfer fixture can be approved only through the staff verification flow and persists the verified payment state.",
      },
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 6,
        prerequisites: ["E2E-TARGETED-PAYMENT fixture is resettable"],
        manualChecklistCount: 0,
        testCases: [{ id: "TC-F10-06-41", assertion: "A staged bank-transfer fixture can be approved only through the staff verification flow and persists the verified payment state." }],
      },
    },
  },
  {
    targetId: "storefront-discount-checkout",
    packId: "storefront-checkout-critical-flow",
    packVersion: 1,
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    spec: "tests/targeted-smoke/storefront-checkout.smoke.spec.ts",
    project: "f40-targeted-smoke",
    testCases: [
      {
        id: "TC-F09.32",
        assertion:
          "A guest can reach checkout for the dedicated fixture without an authentication redirect.",
      },
      {
        id: "TC-F09.30",
        assertion:
          "A valid fixture checkout creates exactly one order, clears the cart, and reaches its confirmation state.",
      },
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 7,
        prerequisites: ["QA-Tshirt-SML fixture is resettable", "Guest checkout fixture is available"],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.32", assertion: "A guest can reach checkout for the dedicated fixture without an authentication redirect." },
          { id: "TC-F09.30", assertion: "A valid fixture checkout creates exactly one order, clears the cart, and reaches its confirmation state." },
        ],
      },
    },
  },
] as const;

function isSafeSpecPath(value: string): boolean {
  return (
    value.startsWith(TARGETED_SPEC_PREFIX) &&
    value.endsWith(".smoke.spec.ts") &&
    !value.includes("..") &&
    /^[A-Za-z0-9_./-]+$/.test(value)
  );
}

/** Fails closed before a registry entry can become an executable CI input. */
export function validateTargetedSmokePacks(
  packs: readonly TargetedSmokePack[],
  knownTargetIds: ReadonlySet<string>,
): void {
  const identities = new Set<string>();
  const packIds = new Set<string>();

  for (const pack of packs) {
    const identity = `${pack.targetId}:${pack.packVersion}`;
    if (!knownTargetIds.has(pack.targetId))
      throw new Error(`Unknown targeted Smoke target: ${pack.targetId}`);
    if (identities.has(identity))
      throw new Error(`Duplicate targeted Smoke identity: ${identity}`);
    if (packIds.has(pack.packId))
      throw new Error(`Duplicate targeted Smoke pack ID: ${pack.packId}`);
    if (!MACHINE_ID.test(pack.packId) || !MACHINE_ID.test(pack.fixtureKey))
      throw new Error(`Unsafe targeted Smoke identifier: ${pack.packId}`);
    if (!Number.isSafeInteger(pack.packVersion) || pack.packVersion < 1)
      throw new Error(`Invalid targeted Smoke pack version: ${pack.packId}`);
    if (!Number.isSafeInteger(pack.fixtureCapacity) || pack.fixtureCapacity < 1)
      throw new Error(`Invalid fixture capacity: ${pack.fixtureKey}`);
    if (!PLAYWRIGHT_PROJECT.test(pack.project))
      throw new Error(`Unsafe Playwright project: ${pack.project}`);
    if (!isSafeSpecPath(pack.spec))
      throw new Error(`Unsafe targeted Smoke spec: ${pack.spec}`);
    if (!pack.testCases.length)
      throw new Error(`Targeted Smoke pack has no test cases: ${pack.packId}`);

    const testCaseIds = new Set<string>();
    for (const testCase of pack.testCases) {
      if (!TEST_CASE_ID.test(testCase.id))
        throw new Error(`Invalid test case ID: ${testCase.id}`);
      if (!testCase.assertion.trim())
        throw new Error(`Missing assertion contract: ${testCase.id}`);
      if (testCaseIds.has(testCase.id))
        throw new Error(`Duplicate test case ID in pack: ${testCase.id}`);
      testCaseIds.add(testCase.id);
    }
    for (const [profile, contract] of Object.entries(pack.manualProfiles ?? {})) {
      if (profile !== "smoke" && profile !== "regression")
        throw new Error(`Unknown manual profile for pack: ${pack.packId}`);
      if (!contract || !Number.isSafeInteger(contract.estimatedDurationMinutes) || contract.estimatedDurationMinutes < 1 || contract.estimatedDurationMinutes > 30)
        throw new Error(`Invalid manual profile duration: ${pack.packId}`);
      if (!contract.prerequisites.length || !contract.testCases.length)
        throw new Error(`Incomplete manual profile contract: ${pack.packId}`);
      const profileIds = new Set(contract.testCases.map((testCase) => testCase.id));
      // The workflow executes the static pack spec, not a profile-specific
      // subset. Keep the preview contract identical to what Actions runs.
      if (profileIds.size !== contract.testCases.length || profileIds.size !== testCaseIds.size || [...profileIds].some((id) => !testCaseIds.has(id)))
        throw new Error(`Manual profile test cases must match pack contract: ${pack.packId}`);
      if (contract.testCases.some((testCase) => !TEST_CASE_ID.test(testCase.id) || !testCase.assertion.trim()))
        throw new Error(`Invalid manual profile test case: ${pack.packId}`);
    }

    identities.add(identity);
    packIds.add(pack.packId);
  }
}

/**
 * Resolves only active allow-listed packs. An absent pack is intentionally an
 * empty result: the dispatcher records a coverage gap and must not widen into
 * a full suite.
 */
export function resolveTargetedSmokePacks(
  targetIds: readonly string[],
  packs: readonly TargetedSmokePack[] = TARGETED_SMOKE_PACKS,
): TargetedSmokePack[] {
  const requested = new Set(targetIds);
  return packs
    .filter((pack) => requested.has(pack.targetId))
    .slice()
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
}

/** Returns a target-specific approved manual profile; undefined is a safe coverage gap. */
export function resolveManualQaPack(
  targetId: string,
  profile: ManualQaProfile,
  packs: readonly TargetedSmokePack[] = TARGETED_SMOKE_PACKS,
): { pack: TargetedSmokePack; profile: TargetedQaPackProfile } | undefined {
  const pack = packs.find((candidate) => candidate.targetId === targetId);
  const profileContract = pack?.manualProfiles?.[profile];
  return pack && profileContract ? { pack, profile: profileContract } : undefined;
}
