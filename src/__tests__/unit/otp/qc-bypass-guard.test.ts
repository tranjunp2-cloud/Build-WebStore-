/**
 * TC-QC-OTP-01 → 04 — QC OTP bypass guard tests.
 *
 * Verifies the triple-guard in `src/lib/otp/qc-bypass.ts` refuses to
 * activate outside the QC lane, so an accidental env var on production
 * cannot leak the bypass to real customer emails.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  canBypassOtpForEmail,
  isQcBypassEnabled,
  isValidQcBypass,
  getQcBypassCode,
} from '@/lib/otp/qc-bypass'

const ENV_KEYS = [
  'APP_ENV',
  'NEXT_PUBLIC_APP_ENV',
  'QC_OTP_BYPASS_ENABLED',
  'QC_OTP_BYPASS_DOMAIN',
  'QC_OTP_BYPASS_CODE',
] as const

function snapshotEnv() {
  return ENV_KEYS.reduce<Record<string, string | undefined>>((acc, k) => {
    acc[k] = process.env[k]
    return acc
  }, {})
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
}

describe('qc-bypass guard', () => {
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = snapshotEnv()
    // Wipe every relevant env var so each test starts clean.
    for (const k of ENV_KEYS) delete process.env[k]
  })

  afterEach(() => restoreEnv(saved))

  // ─── TC-QC-OTP-01: production-scope leak refused ───────────────────
  describe('TC-QC-OTP-01 — production-scope leak', () => {
    it('refuses bypass when APP_ENV=production even if all other vars set', () => {
      process.env.APP_ENV = 'production'
      process.env.QC_OTP_BYPASS_ENABLED = 'true'
      process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
      process.env.QC_OTP_BYPASS_CODE = '123456'
      expect(isQcBypassEnabled()).toBe(false)
      expect(canBypassOtpForEmail('qc-owner-1@primeweb.local')).toBe(false)
      expect(isValidQcBypass('qc-owner-1@primeweb.local', '123456')).toBe(false)
    })

    it('refuses bypass when APP_ENV=staging even if all other vars set', () => {
      process.env.APP_ENV = 'staging'
      process.env.QC_OTP_BYPASS_ENABLED = 'true'
      process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
      process.env.QC_OTP_BYPASS_CODE = '123456'
      expect(canBypassOtpForEmail('qc-owner-1@primeweb.local')).toBe(false)
    })
  })

  // ─── TC-QC-OTP-02: explicit opt-in required ────────────────────────
  describe('TC-QC-OTP-02 — QC_OTP_BYPASS_ENABLED must be true', () => {
    it('refuses when QC_OTP_BYPASS_ENABLED is unset', () => {
      process.env.APP_ENV = 'qc-test'
      process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
      process.env.QC_OTP_BYPASS_CODE = '123456'
      expect(isQcBypassEnabled()).toBe(false)
    })

    it('refuses when QC_OTP_BYPASS_ENABLED="false"', () => {
      process.env.APP_ENV = 'qc-test'
      process.env.QC_OTP_BYPASS_ENABLED = 'false'
      process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
      process.env.QC_OTP_BYPASS_CODE = '123456'
      expect(isQcBypassEnabled()).toBe(false)
    })

    it('refuses when QC_OTP_BYPASS_ENABLED="1" (must be literal "true")', () => {
      process.env.APP_ENV = 'qc-test'
      process.env.QC_OTP_BYPASS_ENABLED = '1'
      process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
      process.env.QC_OTP_BYPASS_CODE = '123456'
      expect(isQcBypassEnabled()).toBe(false)
    })
  })

  // ─── TC-QC-OTP-03: domain restrict ─────────────────────────────────
  describe('TC-QC-OTP-03 — email domain restrict', () => {
    beforeEach(() => {
      process.env.APP_ENV = 'qc-test'
      process.env.QC_OTP_BYPASS_ENABLED = 'true'
      process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
      process.env.QC_OTP_BYPASS_CODE = '123456'
    })

    it('accepts @primeweb.local email', () => {
      expect(canBypassOtpForEmail('qc-owner-1@primeweb.local')).toBe(true)
    })

    it('accepts email regardless of casing', () => {
      expect(canBypassOtpForEmail('QC-Owner-1@PRIMEWEB.LOCAL')).toBe(true)
    })

    it('refuses @gmail.com even with all bypass vars set', () => {
      expect(canBypassOtpForEmail('real-customer@gmail.com')).toBe(false)
    })

    it('refuses @primeweb.app (production-like domain)', () => {
      expect(canBypassOtpForEmail('admin@primeweb.app')).toBe(false)
    })

    it('refuses empty / undefined email', () => {
      expect(canBypassOtpForEmail('')).toBe(false)
      expect(canBypassOtpForEmail(undefined)).toBe(false)
    })

    it('refuses when QC_OTP_BYPASS_DOMAIN env var unset', () => {
      delete process.env.QC_OTP_BYPASS_DOMAIN
      expect(canBypassOtpForEmail('qc-owner-1@primeweb.local')).toBe(false)
    })
  })

  // ─── TC-QC-OTP-04: code equality + full-path accept ────────────────
  describe('TC-QC-OTP-04 — code equality + full-path', () => {
    beforeEach(() => {
      process.env.APP_ENV = 'qc-test'
      process.env.QC_OTP_BYPASS_ENABLED = 'true'
      process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
      process.env.QC_OTP_BYPASS_CODE = '123456'
    })

    it('accepts matching code for allowed domain', () => {
      expect(isValidQcBypass('qc-owner-1@primeweb.local', '123456')).toBe(true)
    })

    it('refuses mismatched code for allowed domain', () => {
      expect(isValidQcBypass('qc-owner-1@primeweb.local', '999999')).toBe(false)
    })

    it('refuses matching code for disallowed domain (leak guard)', () => {
      expect(isValidQcBypass('real-customer@gmail.com', '123456')).toBe(false)
    })

    it('getQcBypassCode returns the configured code', () => {
      expect(getQcBypassCode()).toBe('123456')
    })

    it('getQcBypassCode throws when code missing', () => {
      delete process.env.QC_OTP_BYPASS_CODE
      expect(() => getQcBypassCode()).toThrow(/QC_OTP_BYPASS_CODE/)
    })

    it('getQcBypassCode throws when code shorter than 4 chars', () => {
      process.env.QC_OTP_BYPASS_CODE = '12'
      expect(() => getQcBypassCode()).toThrow(/QC_OTP_BYPASS_CODE/)
    })
  })

  // ─── TC-PERF-158: only the server APP_ENV stamps the QC lane ─────────
  it('[TC-PERF-158] refuses NEXT_PUBLIC_APP_ENV=qc-test alone (public build value, not a lane stamp)', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'qc-test'
    process.env.QC_OTP_BYPASS_ENABLED = 'true'
    process.env.QC_OTP_BYPASS_DOMAIN = '@primeweb.local'
    process.env.QC_OTP_BYPASS_CODE = '123456'
    expect(isQcBypassEnabled()).toBe(false)
    expect(canBypassOtpForEmail('qc-owner-1@primeweb.local')).toBe(false)
  })

  it('[TC-PERF-158] matches the exact mailbox domain, even when configured without "@"', () => {
    process.env.APP_ENV = 'qc-test'
    process.env.QC_OTP_BYPASS_ENABLED = 'true'
    process.env.QC_OTP_BYPASS_DOMAIN = 'example.com'
    expect(canBypassOtpForEmail('qc-owner-1@example.com')).toBe(true)
    expect(canBypassOtpForEmail('QC-Owner-1@EXAMPLE.com')).toBe(true)
    expect(canBypassOtpForEmail('victim@evilexample.com')).toBe(false)
    expect(canBypassOtpForEmail('victim@example.com.evil.my')).toBe(false)
  })
})
