// @vitest-environment node
import { afterEach, describe, it, expect, vi } from 'vitest'
import { passwordFor, userAuth } from '@/lib/migration/pw1-json/user-auth'

afterEach(() => vi.unstubAllEnvs())

describe('[TC-F42-IMP-MISSING-CREDENTIAL] Missing user credentials', () => {
  it('allows completely absent credentials only under the explicit fallback policy', async () => {
    // Arrange
    const entity = { sourceId: '87' }, credentials = new Map()
    // Act / Assert
    expect(await passwordFor(entity, credentials, true)).toBeNull()
    await expect(passwordFor(entity, credentials)).rejects.toThrow('VERIFIABLE_CREDENTIAL_REQUIRED')
    expect(await passwordFor(entity, new Map([['87', { key_string: null }]]), true)).toBeNull()
  })
  it.each([{key_string: 'present'}, {key_string: null, passwordHash:'present'}])('rejects partial credentials instead of masking a source error', async credential => {
    // Arrange / Act / Assert
    await expect(passwordFor({sourceId:'87'},new Map([['87',credential]]),true)).rejects.toThrow('VERIFIABLE_CREDENTIAL_REQUIRED')
  })
  it('does not downgrade invalid supplied credentials to random passwords', async () => {
    // Arrange
    vi.stubEnv('PW1_APP_KEY', 'base64:' + Buffer.alloc(32).toString('base64'))
    vi.stubEnv('SSO_ENCRYPTION_KEY', 'a'.repeat(64))
    // Act / Assert
    await expect(passwordFor({sourceId:'87'}, new Map([['87',{key_string:'invalid',passwordHash:'invalid'}]]), true)).rejects.toThrow('SOURCE_PASSWORD_HASH_UNSUPPORTED')
    await expect(passwordFor({sourceId:'87'}, new Map([['87',{key_string:'invalid',passwordHash:'$2y$10$'+'a'.repeat(53)}]]), true)).rejects.toThrow()
  })
  it('creates distinct high-entropy secrets and no recoverable keyString', () => {
    // Arrange / Act
    const first = userAuth(null), second = userAuth(null)
    // Assert
    expect(first.password).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.password).not.toBe(second.password)
    expect(first.keyString).toBeNull()
    expect(second.keyString).toBeNull()
  })
})
