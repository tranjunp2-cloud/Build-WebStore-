/**
 * Unit tests for user-contact-defaults.
 *
 * Coverage: TC-F01-W.09 — contact defaults for AI gen. Priority per field:
 * wizard form > existing site contactInfo > account. Covers new site,
 * regenerate (must not overwrite owner edits), PW1 migration (no account
 * fallback), QC accounts, and the `sites.contactInfo` payload.
 */

import { describe, it, expect } from 'vitest'
import {
  pickUserContactDefaults,
  withUserContactDefaults,
  applyGenerationContact,
  buildSiteContactInfo,
} from '@/lib/ai/user-contact-defaults'

const ACCOUNT = { email: 'Owner@Login.MY', phone: '60123456789' }

describe('TC-F01-W.09 — pickUserContactDefaults', () => {
  it('returns normalized email + phone from the account', () => {
    expect(pickUserContactDefaults({ email: ' Owner@Shop.MY ', phone: ' 6012  3456789 ' }))
      .toEqual({ email: 'owner@shop.my', phone: '6012 3456789' })
  })

  it('skips QC @primeweb.local emails', () => {
    expect(pickUserContactDefaults({ email: 'qa-1@primeweb.local', phone: '60123456789' }))
      .toEqual({ phone: '60123456789' })
  })

  it('omits missing phone instead of inventing one', () => {
    expect(pickUserContactDefaults({ email: 'a@b.my' })).toEqual({ email: 'a@b.my' })
    expect(pickUserContactDefaults({ email: 'a@b.my', phone: null })).toEqual({ email: 'a@b.my' })
  })
})

describe('TC-F01-W.09 — withUserContactDefaults', () => {
  it('fills empty fields from defaults', () => {
    expect(withUserContactDefaults({ phone: '', email: undefined }, { phone: '60123456789', email: 'a@b.my' }))
      .toMatchObject({ phone: '60123456789', email: 'a@b.my' })
  })

  it('keeps form-supplied values over defaults', () => {
    expect(withUserContactDefaults(
      { phone: '+60 3-1111 2222', email: 'shop@x.my', address: '1 Jalan A' },
      { phone: '60123456789', email: 'owner@y.my', address: '9 Jalan Z' },
    )).toMatchObject({ phone: '+60 3-1111 2222', email: 'shop@x.my', address: '1 Jalan A' })
  })
})

describe('TC-F01-W.09 — applyGenerationContact', () => {
  it('new site: empty form takes account email + phone, address stays empty', () => {
    const out = applyGenerationContact({}, { user: ACCOUNT })
    expect(out).toMatchObject({ email: 'owner@login.my', phone: '60123456789' })
    expect(out.address).toBeUndefined()
  })

  it('regenerate: existing contactInfo wins over account for fields it has', () => {
    const out = applyGenerationContact({}, {
      user: ACCOUNT,
      existingContactInfo: { email: 'shop@mybiz.my', address: '1 Jalan Bukit' },
    })
    expect(out).toMatchObject({ email: 'shop@mybiz.my', address: '1 Jalan Bukit', phone: '60123456789' })
  })

  it('regenerate: form-supplied values still win over existing contactInfo', () => {
    const out = applyGenerationContact({ email: 'new@mybiz.my' }, {
      user: ACCOUNT,
      existingContactInfo: { email: 'shop@mybiz.my' },
    })
    expect(out.email).toBe('new@mybiz.my')
  })

  it('migration: never uses the owner account, but still honors site contactInfo', () => {
    const bare = applyGenerationContact({}, { user: ACCOUNT, migration: true })
    expect(bare.email).toBeUndefined()
    expect(bare.phone).toBeUndefined()

    const withSite = applyGenerationContact({}, {
      user: ACCOUNT,
      migration: true,
      existingContactInfo: { email: 'shop@mybiz.my' },
    })
    expect(withSite.email).toBe('shop@mybiz.my')
    expect(withSite.phone).toBeUndefined()
  })

  it('QC account on a new site yields no email', () => {
    const out = applyGenerationContact({}, { user: { email: 'qa@primeweb.local', phone: undefined } })
    expect(out.email).toBeUndefined()
  })
})

describe('TC-F01-W.09 — buildSiteContactInfo', () => {
  it('keeps only non-empty fields', () => {
    expect(buildSiteContactInfo({ phone: '', email: 'a@b.my', address: '  ' })).toEqual({ email: 'a@b.my' })
  })

  it('returns empty object when nothing supplied', () => {
    expect(buildSiteContactInfo({})).toEqual({})
  })
})
