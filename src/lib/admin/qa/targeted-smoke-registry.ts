/**
 * Checked-in allow-list for US-F40-03. A deploy can select a pack from this
 * registry, but it can never supply a project, spec, shell command, or test
 * identifier of its own.
 */
export type TargetedSmokeTestCase = {
  id: string;
  assertion: string;
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
