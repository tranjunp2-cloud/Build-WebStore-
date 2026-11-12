import { expect, test } from '@playwright/test'
import {
    assertAllowedAuthenticatedE2ETarget,
    isAllowedAuthenticatedE2ETarget,
    LIVE_STAGING_E2E_ORIGIN,
    LOCAL_E2E_ORIGIN,
    LOCAL_E2E_WORKTREE_ORIGIN,
} from './helpers/authenticated-target'

// ── TC-F37-01-29: Authenticated E2E target allowlist ──────────────────
test.describe('[TC-F37-01-29] authenticated E2E target allowlist', () => {
    test('accepts only the configured local and live-staging origins', () => {
        // Arrange
        const allowedTargets = [
            LOCAL_E2E_ORIGIN,
            LOCAL_E2E_WORKTREE_ORIGIN,
            `${LIVE_STAGING_E2E_ORIGIN}/editor/123`,
        ]

        // Act
        const results = allowedTargets.map(isAllowedAuthenticatedE2ETarget)

        // Assert
        expect(results).toEqual([true, true, true])
    })

    test('rejects malformed, production and lookalike targets before authentication', () => {
        // Arrange
        const rejectedTargets: unknown[] = [
            undefined,
            'not-a-url',
            'https://web-v2.ecommercehub.my',
            'https://web-v2.dev.ecommercehub.my.evil.example',
        ]

        // Act
        const assertTargets = () => rejectedTargets.forEach(assertAllowedAuthenticatedE2ETarget)

        // Assert
        expect(assertTargets).toThrow(/Refusing authenticated E2E/)
        expect(rejectedTargets.map(isAllowedAuthenticatedE2ETarget)).toEqual([
            false,
            false,
            false,
            false,
        ])
    })
})
