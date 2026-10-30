import { describe, it, expect } from 'vitest'

const { isProductionDeploy } = require('../../../../scripts/db-setup') as {
    isProductionDeploy: (env: Record<string, string | undefined>) => boolean
}

describe('db-setup isProductionDeploy()', () => {
    it('is true for NEXT_PUBLIC_APP_ENV=production', () => {
        expect(isProductionDeploy({ NEXT_PUBLIC_APP_ENV: 'production' })).toBe(true)
    })

    it('is true for VERCEL_ENV=production when no app env is set', () => {
        expect(isProductionDeploy({ VERCEL_ENV: 'production' })).toBe(true)
    })

    it('app env wins over VERCEL_ENV (staging built as a Vercel production target)', () => {
        expect(isProductionDeploy({ NEXT_PUBLIC_APP_ENV: 'staging', VERCEL_ENV: 'production' })).toBe(false)
    })

    it.each(['staging', 'qc-test', 'development', ''])('is false for %s', (appEnv) => {
        expect(isProductionDeploy({ APP_ENV: appEnv })).toBe(false)
    })

    it('is false when nothing is set (local)', () => {
        expect(isProductionDeploy({})).toBe(false)
    })
})
