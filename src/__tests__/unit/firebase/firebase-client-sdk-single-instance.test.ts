import { describe, it, expect, afterEach } from 'vitest'
import { deleteApp, getApps, initializeApp } from 'firebase/app'
import { initializeAuth, inMemoryPersistence } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// ── TC-F16.58: the installed Firebase client SDK registers auth/database on ONE @firebase/app (#1972) ──
// Uses the real packages (no mocks): a second @firebase/app copy in the install tree makes
// initializeAuth throw "Component auth has not been registered yet" and the client silently
// falls back to polling. package.json `overrides` pins a single @firebase/app.

afterEach(async () => {
    await Promise.all(getApps().map((a) => deleteApp(a)))
})

describe('[TC-F16.58] Firebase client SDK single @firebase/app instance', () => {
    it('initializeAuth + getDatabase work on an app created via firebase/app', () => {
        const app = initializeApp(
            { apiKey: 'test-key', databaseURL: 'https://test-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'test' },
            'pw2-notif-sdk-test',
        )

        expect(() => initializeAuth(app, { persistence: inMemoryPersistence })).not.toThrow()
        expect(() => getDatabase(app)).not.toThrow()
    })
})
