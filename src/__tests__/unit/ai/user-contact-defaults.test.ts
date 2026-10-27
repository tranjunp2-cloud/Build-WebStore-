/**
 * Unit tests for user-contact-defaults.
 *
 * Coverage: TC-F01-W.09 — account phone/email fill empty wizard fields,
 * QC accounts are skipped, form values win, site contactInfo only gets non-empty fields.
 */

import { describe, it, expect } from 'vitest'
import {
  pickUserContactDefaults,
  withUserContactDefaults,
  buildSiteContactInfo,
} from '@/lib/ai/user-contact-defaults'

describe('TC-F01-W.09 — pickUserContactDefaults', () => {
  it('returns normalized email + phone from the account', () => {
    const out = pickUserContactDefaults({ email: ' Owner@Shop.MY ', phone: ' 6012  3456789 ' })
    expect(out).toEqual({ email: 'owner@shop.my', phone: '6012 3456789' })
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
    const out = withUserContactDefaults({ phone: '', email: undefined }, { phone: '60123456789', email: 'a@b.my' })
    expect(out).toMatchObject({ phone: '60123456789', email: 'a@b.my' })
  })

  it('keeps form-supplied values over account values', () => {
    const out = withUserContactDefaults(
      { phone: '+60 3-1111 2222', email: 'shop@x.my' },
      { phone: '60123456789', email: 'owner@y.my' },
    )
    expect(out).toMatchObject({ phone: '+60 3-1111 2222', email: 'shop@x.my' })
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
