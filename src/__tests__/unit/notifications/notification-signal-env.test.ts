import { describe, it, expect, vi, afterEach } from 'vitest'
import {
    getNotificationSignalEnv,
    signalUid,
    userSignalPath,
    userSignalParentPath,
    broadcastSignalPath,
} from '@/lib/notifications/notification-signal-env'

// ── TC-F16.46: Firebase doorbell env prefix + uid/path helpers (#1972) ──

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('[TC-F16.46] notification signal env helpers', () => {
    it.each(['staging', 'production', 'preview'])('uses VERCEL_TARGET_ENV=%s as the prefix', (env) => {
        vi.stubEnv('VERCEL_TARGET_ENV', env)

        expect(getNotificationSignalEnv()).toBe(env)
        expect(userSignalPath(7)).toBe(`pw2/${env}/u/7`)
        expect(userSignalParentPath()).toBe(`pw2/${env}/u`)
        expect(broadcastSignalPath()).toBe(`pw2/${env}/broadcast`)
    })

    it('falls back to "development" when VERCEL_TARGET_ENV is unset', () => {
        vi.stubEnv('VERCEL_TARGET_ENV', '')
        vi.stubEnv('VERCEL', '')

        expect(getNotificationSignalEnv()).toBe('development')
    })

    it('builds the Firebase uid the database rules compare against', () => {
        vi.stubEnv('VERCEL_TARGET_ENV', 'staging')

        // Must equal 'pw2_' + $env + '_' + $userId in firebase/pw2-database-rules.json
        expect(signalUid(42)).toBe('pw2_staging_42')
    })

    it('strips characters that could escape the path (case, slashes, dots)', () => {
        vi.stubEnv('VERCEL_TARGET_ENV', 'Stag/ing.json')

        expect(getNotificationSignalEnv()).toBe('staging' + 'json')
        expect(userSignalPath(1)).not.toMatch(/[./]{2}|\.\./)
    })
})
