/**
 * TC-AISEC-110, TC-AISEC-111 — E2E OTP bypass gate (`src/lib/otp/e2e-bypass.ts`).
 *
 * TC-AISEC-110: the fixed `E2E_TEST_OTP_CODE` for `TEST_EMAIL` only works on the qc-test lane
 * or with the explicit `E2E_OTP_BYPASS_ENABLED=true` opt-in; any other env refuses it.
 * TC-PERF-164: never on a Vercel production deployment (`VERCEL_ENV=production`), whatever the env vars say.
 * TC-AISEC-111: even with the gate open, never for a super-admin, and never for an account
 * with an ACTIVE membership outside `E2E_OTP_BYPASS_TENANT_ID` (when set).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  canUseE2eOtpBypass,
  isE2eBypassEnvEnabled,
  isE2eBypassUserAllowed,
  isValidE2eBypass,
} from '@/lib/otp/e2e-bypass'

const EMAIL = 'e2e-bot@primeweb.app'
const CODE = '424242'
const plainUser = { roles: ['tenant-owner'], tenants: [] }

function openGateEnv() {
  vi.stubEnv('E2E_TEST_OTP_CODE', CODE)
  vi.stubEnv('TEST_EMAIL', EMAIL)
  vi.stubEnv('APP_ENV', 'staging')
  vi.stubEnv('E2E_OTP_BYPASS_ENABLED', 'true')
  vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '')
}

describe('e2e-bypass guard', () => {
  beforeEach(() => {
    vi.stubEnv('E2E_TEST_OTP_CODE', CODE)
    vi.stubEnv('TEST_EMAIL', EMAIL)
    vi.stubEnv('APP_ENV', '')
    vi.stubEnv('E2E_OTP_BYPASS_ENABLED', '')
    vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '')
    vi.stubEnv('VERCEL_ENV', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('TC-AISEC-110 — env gate', () => {
    it('refuses when neither APP_ENV=qc-test nor the opt-in is set', () => {
      // Arrange — beforeEach: code + email set, gate vars empty
      // Act
      const enabled = isE2eBypassEnvEnabled()
      const valid = isValidE2eBypass(EMAIL, CODE, plainUser)
      // Assert
      expect(enabled).toBe(false)
      expect(valid).toBe(false)
      expect(canUseE2eOtpBypass(EMAIL, plainUser)).toBe(false)
    })

    it('refuses on a production-like env without the opt-in (APP_ENV=production / staging)', () => {
      vi.stubEnv('APP_ENV', 'production')
      expect(isValidE2eBypass(EMAIL, CODE, plainUser)).toBe(false)

      vi.stubEnv('APP_ENV', 'staging')
      expect(isValidE2eBypass(EMAIL, CODE, plainUser)).toBe(false)
    })

    it('refuses when the opt-in is anything but the exact string "true"', () => {
      vi.stubEnv('APP_ENV', 'production')
      for (const value of ['false', '1', 'TRUE', 'yes']) {
        vi.stubEnv('E2E_OTP_BYPASS_ENABLED', value)
        expect(isE2eBypassEnvEnabled()).toBe(false)
      }
    })

    it('allows on APP_ENV=qc-test', () => {
      vi.stubEnv('APP_ENV', 'qc-test')

      expect(isE2eBypassEnvEnabled()).toBe(true)
      expect(isValidE2eBypass(EMAIL, CODE, plainUser)).toBe(true)
    })

    it('allows with E2E_OTP_BYPASS_ENABLED=true on another env', () => {
      openGateEnv()

      expect(isE2eBypassEnvEnabled()).toBe(true)
      expect(canUseE2eOtpBypass(EMAIL, plainUser)).toBe(true)
      expect(isValidE2eBypass(EMAIL, CODE, plainUser)).toBe(true)
    })

    it('TC-PERF-164: refuses on a Vercel production deployment even with the opt-in or the qc-test stamp', () => {
      openGateEnv()
      vi.stubEnv('VERCEL_ENV', 'production')
      expect(isE2eBypassEnvEnabled()).toBe(false)
      expect(isValidE2eBypass(EMAIL, CODE, plainUser)).toBe(false)

      vi.stubEnv('APP_ENV', 'qc-test')
      expect(isE2eBypassEnvEnabled()).toBe(false)

      vi.stubEnv('VERCEL_ENV', 'preview')
      expect(isE2eBypassEnvEnabled()).toBe(true)
    })

    it('still needs TEST_EMAIL, the configured code and a matching submitted code', () => {
      openGateEnv()

      expect(isValidE2eBypass('someone@else.com', CODE, plainUser)).toBe(false)
      expect(isValidE2eBypass(EMAIL, '000000', plainUser)).toBe(false)
      expect(isValidE2eBypass(EMAIL, CODE.slice(0, 4), plainUser)).toBe(false)
      vi.stubEnv('E2E_TEST_OTP_CODE', '')
      expect(canUseE2eOtpBypass(EMAIL, plainUser)).toBe(false)
      expect(isValidE2eBypass(EMAIL, '', plainUser)).toBe(false)
    })
  })

  describe('TC-AISEC-111 — account guards', () => {
    beforeEach(() => openGateEnv())

    it('refuses a super-admin even with the gate open', () => {
      const admin = { roles: ['super-admin'], tenants: [] }

      expect(isE2eBypassUserAllowed(admin)).toBe(false)
      expect(canUseE2eOtpBypass(EMAIL, admin)).toBe(false)
      expect(isValidE2eBypass(EMAIL, CODE, admin)).toBe(false)
    })

    it('refuses an account with an active membership in a workspace other than the QA one', () => {
      vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '42')
      const user = {
        roles: ['tenant-owner'],
        tenants: [
          { tenant: 42, status: 'active' },
          { tenant: { id: 7 }, status: 'active' },
        ],
      }

      expect(isValidE2eBypass(EMAIL, CODE, user)).toBe(false)
    })

    it('treats a membership without status as active (field default)', () => {
      vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '42')

      expect(isE2eBypassUserAllowed({ tenants: [{ tenant: 7 }] })).toBe(false)
    })

    it('allows an account whose only active membership is the QA workspace (id or populated doc)', () => {
      vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '42')

      expect(isValidE2eBypass(EMAIL, CODE, { tenants: [{ tenant: 42, status: 'active' }] })).toBe(true)
      expect(isValidE2eBypass(EMAIL, CODE, { tenants: [{ tenant: { id: '42' }, status: 'active' }] })).toBe(true)
    })

    it('accepts a comma-separated list of QA workspaces', () => {
      vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '42, 43')
      const user = { tenants: [{ tenant: 42, status: 'active' }, { tenant: 43, status: 'active' }] }

      expect(isE2eBypassUserAllowed(user)).toBe(true)
    })

    it('does not let a suspended membership elsewhere block the bypass', () => {
      vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '42')
      const user = {
        tenants: [
          { tenant: 42, status: 'active' },
          { tenant: 8, status: 'suspended' },
        ],
      }

      expect(isValidE2eBypass(EMAIL, CODE, user)).toBe(true)
    })

    it('refuses a pending invite to another workspace (this login would accept it)', () => {
      vi.stubEnv('E2E_OTP_BYPASS_TENANT_ID', '42')
      const user = { tenants: [{ tenant: 42, status: 'active' }, { tenant: 7, status: 'pending' }] }

      expect(isValidE2eBypass(EMAIL, CODE, user)).toBe(false)
    })

    it('skips the workspace check when E2E_OTP_BYPASS_TENANT_ID is unset', () => {
      const user = { tenants: [{ tenant: 7, status: 'active' }] }

      expect(isValidE2eBypass(EMAIL, CODE, user)).toBe(true)
    })

    it('refuses when no account is given', () => {
      expect(isE2eBypassUserAllowed(undefined)).toBe(false)
      expect(isValidE2eBypass(EMAIL, CODE, null)).toBe(false)
    })
  })
})
