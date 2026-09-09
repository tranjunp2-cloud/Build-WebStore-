export type SeedInventory<Preset, Seed> = {
    pairs: Array<{ preset: Preset; seed: Seed }>
    missingCount: number
}

/**
 * Compose every required preset while retaining an explicit count of invalid
 * entries. Seed callers must fail the command when `missingCount` is non-zero;
 * silently dropping a preset would leave production with incomplete inventory.
 */
export function buildRequiredSeedInventory<Preset, Seed>(
    presets: readonly Preset[],
    compose: (preset: Preset) => Seed | null,
): SeedInventory<Preset, Seed> {
    const pairs: Array<{ preset: Preset; seed: Seed }> = []
    let missingCount = 0

    for (const preset of presets) {
        const seed = compose(preset)
        if (seed === null) {
            missingCount += 1
            continue
        }
        pairs.push({ preset, seed })
    }

    return { pairs, missingCount }
}

export function hasSeedInventoryFailure(writeFailures: number, missingCount: number): boolean {
    return writeFailures > 0 || missingCount > 0
}

/** Only templates stamped by the seed system are safe to reconcile in place. */
export function isManagedSeedTemplate(blockSchemaVersion: unknown): boolean {
    return typeof blockSchemaVersion === 'string' && /^[a-f0-9]{16}$/.test(blockSchemaVersion)
}
