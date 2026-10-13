// @vitest-environment node
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { legacyEmailAuth } from '@/lib/migration/pw1-json/user-auth'

describe('[TC-F42-IMP-POLICY-003] Legacy email auth uses installed Payload password format', () => {
  it('verifies migrated password with Payload authenticator and rejects the wrong password', async () => {
    // Arrange: resolve the installed implementation; do not mirror its hashing logic in this test.
    const require = createRequire(import.meta.url)
    const modulePath = pathToFileURL(resolve(dirname(require.resolve('payload')), 'auth/strategies/local/authenticate.js')).href
    const { authenticateLocalStrategy } = await import(/* @vite-ignore */ modulePath)
    const oldKey = process.env.SSO_ENCRYPTION_KEY
    process.env.SSO_ENCRYPTION_KEY = '1'.repeat(64)
    try {
      // Act
      const doc = await legacyEmailAuth('Synthetic-password-42!')
      // Assert
      expect(await authenticateLocalStrategy({ doc, password: 'Synthetic-password-42!' })).toEqual(doc)
      expect(await authenticateLocalStrategy({ doc, password: 'wrong-password' })).toBeNull()
      expect(doc).not.toHaveProperty('password')
      expect(doc.keyString).toBeTruthy()
    } finally {
      if (oldKey === undefined) delete process.env.SSO_ENCRYPTION_KEY
      else process.env.SSO_ENCRYPTION_KEY = oldKey
    }
  })
})
