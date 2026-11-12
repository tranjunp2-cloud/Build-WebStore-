/**
 * Unit Tests: POST /api/contact-submit — contact form rate-limiting & submission
 * TC-ID: TC-F04.CS.01..16 — GH-1464 rate-limit key scoping, fail-open,
 * spoof-resistant IP extraction, invalid-site-only probe ceiling, error-path coverage
 * (code-review follow-up)
 * Convention: docs/TEST_CONVENTION.md, .claude/rules/testing.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/contact-submit/route'
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
	getPayload: vi.fn().mockResolvedValue({
		findByID: vi.fn().mockResolvedValue({
			id: 1,
			name: 'Test Site',
			tenant: { id: 7 },
			locale: 'ms',
		}),
		create: vi.fn().mockResolvedValue({ id: 'submission-1' }),
		sendEmail: vi.fn().mockResolvedValue(true),
	}),
}))

const mockNotifyContactLead = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/contact/notify-contact-lead', () => ({
	notifyContactLead: (...args: unknown[]) => mockNotifyContactLead(...args),
}))

// #2179 store-availability gate is covered in storefront/store-unavailable.test.ts; here only its effect on the route.
const mockStoreUnavailable = vi.fn().mockResolvedValue(false)
vi.mock('@/lib/storefront/store-availability', () => ({
	isSiteDocTenantUnavailable: (...args: unknown[]) => mockStoreUnavailable(...args),
}))

// Stateful rate-limit mock: tracks calls per key, allows first 5, blocks 6th+
const rateLimitCalls: Record<string, number> = {}

vi.mock('@/lib/rateLimit', () => ({
	checkRateLimit: vi.fn(async (key: string, limit: number, window: number) => {
		const count = (rateLimitCalls[key] || 0) + 1
		rateLimitCalls[key] = count

		return {
			allowed: count <= limit,
			remaining: Math.max(0, limit - count),
			resetAt: Date.now() + window,
		}
	}),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeReq = (
	body: Record<string, unknown>,
	{ xff, realIp }: { xff?: string; realIp?: string } = {},
) => {
	const url = 'http://localhost:3000/api/contact-submit'
	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (xff) {
		headers['x-forwarded-for'] = xff
	}
	if (realIp) {
		headers['x-real-ip'] = realIp
	}
	return new NextRequest(url, {
		method: 'POST',
		body: JSON.stringify(body),
		headers,
	})
}

const validBody = (overrides = {}) => ({
	name: 'John Doe',
	email: 'john@example.com',
	phone: '123-456-7890',
	subject: 'Project enquiry',
	message: 'This is a test message for contact',
	siteId: '1',
	website: '', // honeypot: empty (not spam)
	...overrides,
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/contact-submit — rate-limiting & honeypot', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset in-test rate-limit counter
		Object.keys(rateLimitCalls).forEach((key) => {
			delete rateLimitCalls[key]
		})
	})

	it('TC-F04.CS.01 — Fresh siteId+IP → 200 success; rate-limit key scoped by site+IP', async () => {
		// Arrange
		const body = validBody({ siteId: '1' })
		const req = makeReq(body, { xff: '1.1.1.1' })

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert
		expect(res.status).toBe(200)
		expect(data.success).toBe(true)
		expect(checkRateLimit).toHaveBeenCalledWith('contact-submit:1:1.1.1.1', 5, 5 * 60 * 1000, { failClosed: true }) // TC-PERF-159: fail-closed (emails the owner)
	})

	it('persists an optional contact subject', async () => {
		const payloadModule = await import('payload')
		const mockPayload = await payloadModule.getPayload({} as never)
		const req = makeReq(validBody({ subject: 'Website consultation' }), { xff: '1.1.1.2' })

		const res = await POST(req)

		expect(res.status).toBe(200)
		expect(mockPayload.create).toHaveBeenCalledWith(expect.objectContaining({
			collection: 'contact-submissions',
			data: expect.objectContaining({ subject: 'Website consultation' }),
		}))
	})

	it('TC-F04.CS.17 — GH-2157: notifies via tenant id from site.tenant (no site.ownerEmail)', async () => {
		mockNotifyContactLead.mockClear()
		const res = await POST(makeReq(validBody(), { xff: '1.1.1.17' }))

		expect(res.status).toBe(200)
		await vi.waitFor(() => expect(mockNotifyContactLead).toHaveBeenCalledTimes(1))
		expect(mockNotifyContactLead).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			tenantId: 7,
			submissionId: 'submission-1',
			siteName: 'Test Site',
			locale: 'ms',
			name: 'John Doe',
			email: 'john@example.com',
		}))
	})

	it('TC-F04.CS.18 — GH-2157: site.tenant as raw id still resolves tenantId', async () => {
		mockNotifyContactLead.mockClear()
		const payloadModule = await import('payload')
		const mockPayload = await payloadModule.getPayload({} as never)
		vi.mocked(mockPayload.findByID).mockResolvedValueOnce({ id: 1, name: 'Raw', tenant: 9 } as never)

		await POST(makeReq(validBody(), { xff: '1.1.1.18' }))

		await vi.waitFor(() => expect(mockNotifyContactLead).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tenantId: 9, locale: 'en' })))
	})

	it('TC-F04.CS.19 — GH-2157: site without tenant → no notify, still 200 and lead saved', async () => {
		mockNotifyContactLead.mockClear()
		const payloadModule = await import('payload')
		const mockPayload = await payloadModule.getPayload({} as never)
		vi.mocked(mockPayload.create).mockClear()
		vi.mocked(mockPayload.findByID).mockResolvedValueOnce({ id: 1, name: 'No tenant' } as never)

		const res = await POST(makeReq(validBody(), { xff: '1.1.1.19' }))

		expect(res.status).toBe(200)
		expect(mockPayload.create).toHaveBeenCalledTimes(1)
		expect(mockNotifyContactLead).not.toHaveBeenCalled()
	})

	it('TC-F04.CS.20 — GH-2157: notify failure never changes the 200 response', async () => {
		mockNotifyContactLead.mockRejectedValueOnce(new Error('ses down'))
		const res = await POST(makeReq(validBody(), { xff: '1.1.1.20' }))

		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ success: true })
	})

	it('TC-F04.CS.02 — Same siteId+IP submitted 6× → 6th call returns 429', async () => {
		// Arrange
		const siteIp = 'contact-submit:1:2.2.2.2'

		// Act & Assert: calls 1-5 succeed
		for (let i = 1; i <= 5; i++) {
			const req = makeReq(validBody({ siteId: '1' }), { xff: '2.2.2.2' })
			const res = await POST(req)
			expect(res.status, `Call ${i} should succeed`).toBe(200)
		}

		// 6th call should be blocked
		const sixthReq = makeReq(validBody({ siteId: '1' }), { xff: '2.2.2.2' })
		const sixthRes = await POST(sixthReq)
		const sixthData = await sixthRes.json()

		expect(sixthRes.status).toBe(429)
		expect(sixthData.error).toContain('Too many submissions')
	})

	it('TC-F04.CS.03 — Two siteIds same IP have independent counters', async () => {
		// Arrange: Site A with IP 3.3.3.3 (submit 5×), then Site B with same IP (submit 1×)
		const siteABody = validBody({ siteId: '101' })
		const siteBBody = validBody({ siteId: '102' })

		// Act: Submit site-A 5 times
		for (let i = 1; i <= 5; i++) {
			const req = makeReq(siteABody, { xff: '3.3.3.3' })
			const res = await POST(req)
			expect(res.status, `Site A call ${i} should succeed`).toBe(200)
		}

		// Site B should still be allowed (independent key)
		const siteBReq = makeReq(siteBBody, { xff: '3.3.3.3' })
		const siteBRes = await POST(siteBReq)

		// Assert
		expect(siteBRes.status, 'Site B first call should succeed (independent counter)').toBe(200)
		expect(checkRateLimit).toHaveBeenCalledWith('contact-submit:101:3.3.3.3', 5, 5 * 60 * 1000, { failClosed: true }) // TC-PERF-159: fail-closed (emails the owner)
		expect(checkRateLimit).toHaveBeenCalledWith('contact-submit:102:3.3.3.3', 5, 5 * 60 * 1000, { failClosed: true }) // TC-PERF-159: fail-closed (emails the owner)
	})

	it('TC-F04.CS.04 — Missing x-forwarded-for header → fail open (no rate-limit check)', async () => {
		// Arrange
		const body = validBody({ siteId: '1' })

		// Act: Submit 6+ times without XFF header
		const results: number[] = []
		for (let i = 1; i <= 6; i++) {
			// Must create new request each time due to body consumption
			const reqBody = validBody({ siteId: '1' })
			const req = makeReq(reqBody) // No xff parameter
			const res = await POST(req)
			results.push(res.status)
		}

		// Assert
		results.forEach((status) => {
			expect(status, 'All requests without XFF should succeed (fail-open)').toBe(200)
		})
		// Verify checkRateLimit was never called for any of these requests
		expect(checkRateLimit).not.toHaveBeenCalled()
	})

	it('TC-F04.CS.05 — Invalid body (missing siteId) → 400; rate-limit not reached', async () => {
		// Arrange
		const body = validBody({ siteId: undefined })
		delete (body as Record<string, unknown>).siteId
		const req = makeReq(body, { xff: '4.4.4.4' })

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert
		expect(res.status).toBe(400)
		expect(data.error).toBeDefined()
		// Rate-limit should not be called before validation
		expect(checkRateLimit).not.toHaveBeenCalled()
	})

	it('TC-F04.CS.06 — Honeypot field filled (website has value) → rejected by zod before route check', async () => {
		// Arrange: website field filled with non-empty value (violates zod max(0) constraint)
		const body = validBody({ website: 'http://spammer.com' }) // Honeypot filled
		const req = makeReq(body, { xff: '5.5.5.5' })

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert: zod validation rejects non-empty website field BEFORE route's honeypot check
		// This means the route's honeypot check (lines 56-58) is currently unreachable.
		// Expected behavior per zod schema: max(0) rejects any string length > 0.
		expect(res.status).toBe(400)
		expect(data.error).toContain('Spam detected')
	})

	it('TC-F04.CS.07 — Spoofed leftmost XFF entry ignored; rightmost (Vercel-appended) IP used for rate-limit key', async () => {
		// Arrange: XFF chain "attacker-spoofed, real-vercel-appended" (rightmost = real)
		const body = validBody({ siteId: '1' })
		const req = makeReq(body, { xff: '9.9.9.9, 6.6.6.6' })

		// Act
		const res = await POST(req)

		// Assert: rate-limit key uses the rightmost (real) IP, never the spoofed leftmost one
		expect(res.status).toBe(200)
		expect(checkRateLimit).toHaveBeenCalledWith('contact-submit:1:6.6.6.6', 5, 5 * 60 * 1000, { failClosed: true }) // TC-PERF-159: fail-closed (emails the owner)
		expect(checkRateLimit).not.toHaveBeenCalledWith(
			expect.stringContaining('9.9.9.9'),
			expect.anything(),
			expect.anything(),
		)
	})

	it('TC-F04.CS.08 — x-real-ip header takes priority over x-forwarded-for', async () => {
		// Arrange: x-real-ip present (Vercel-set) alongside an unrelated XFF value
		const body = validBody({ siteId: '1' })
		const req = makeReq(body, { xff: '8.8.8.8', realIp: '7.1.1.1' })

		// Act
		const res = await POST(req)

		// Assert: x-real-ip wins over x-forwarded-for
		expect(res.status).toBe(200)
		expect(checkRateLimit).toHaveBeenCalledWith('contact-submit:1:7.1.1.1', 5, 5 * 60 * 1000, { failClosed: true }) // TC-PERF-159: fail-closed (emails the owner)
	})

	it('TC-F04.CS.09 — Many distinct VALID siteIds from one IP → no false-positive IP-wide block (200-people/200-sites regression)', async () => {
		// Arrange: 25 requests, each a distinct VALID siteId (findByID resolves truthy for all), same IP
		const ip = '7.7.7.7'
		const results: number[] = []

		// Act
		for (let i = 1; i <= 25; i++) {
			const req = makeReq(validBody({ siteId: `${i}` }), { xff: ip })
			const res = await POST(req)
			results.push(res.status)
		}

		// Assert: ALL succeed — no platform-wide ceiling on legitimate multi-site traffic
		expect(results.every((s) => s === 200), 'all 25 requests to distinct valid sites should succeed').toBe(
			true,
		)
	})

	it('TC-F04.CS.10 — Invalid-site probing capped per-IP: 11th consecutive probe → 429', async () => {
		// Arrange: findByID resolves to null (site not found) for exactly the next 11 calls
		// (queued via mockResolvedValueOnce — falls back to the truthy default afterwards,
		// so this doesn't leak into other tests).
		const payloadModule = await import('payload')
		const mockPayload = await payloadModule.getPayload({} as never)
		for (let i = 0; i < 11; i++) {
			vi.mocked(mockPayload.findByID).mockResolvedValueOnce(null as never)
		}

		const ip = '10.10.10.10'
		const results: { status: number; error?: string }[] = []

		// Act: 11 requests, each a distinct nonexistent siteId, same IP
		for (let i = 1; i <= 11; i++) {
			const req = makeReq(validBody({ siteId: `${900 + i}` }), { xff: ip })
			const res = await POST(req)
			const data = await res.json()
			results.push({ status: res.status, error: data.error })
		}

		// Assert: first 10 probes get the normal 400 "Invalid site"; 11th gets 429
		results.slice(0, 10).forEach((r, i) => {
			expect(r.status, `Probe ${i + 1} should be 400`).toBe(400)
			expect(r.error).toBe('Invalid site')
		})
		expect(results[10].status).toBe(429)
		expect(results[10].error).toContain('Too many submissions')
	})

	it('TC-F04.CS.11 — Missing IP + invalid site → 400, no rate-limit check on either layer (fail-open covers both)', async () => {
		// Arrange: findByID resolves null (site not found), no XFF/x-real-ip header
		const payloadModule = await import('payload')
		const mockPayload = await payloadModule.getPayload({} as never)
		vi.mocked(mockPayload.findByID).mockResolvedValueOnce(null as never)

		const req = makeReq(validBody({ siteId: '999901' })) // no xff, no realIp

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert: normal 400, never 429 — invalid-site-probe check is also skipped when rawIp is absent
		expect(res.status).toBe(400)
		expect(data.error).toBe('Invalid site')
		expect(checkRateLimit).not.toHaveBeenCalled()
	})

	it('TC-F04.CS.12 — Unexpected error (payload.create throws) → 500, generic message', async () => {
		// Arrange: payload.create rejects (e.g. DB failure)
		const payloadModule = await import('payload')
		const mockPayload = await payloadModule.getPayload({} as never)
		vi.mocked(mockPayload.create).mockRejectedValueOnce(new Error('DB connection lost'))

		const req = makeReq(validBody({ siteId: '1' }), { xff: '11.11.11.11' })

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert: generic 500, no internal error details leaked
		expect(res.status).toBe(500)
		expect(data.error).toBe('Something went wrong. Please try again.')
	})

	it('TC-F04.CS.13 — Non-numeric siteId → 400 before rate-limit/DB lookup (cost-amplification guard)', async () => {
		// Arrange: siteId is free-form junk, not a numeric site PK
		const body = validBody({ siteId: 'not-a-real-site-id' })
		const req = makeReq(body, { xff: '12.12.12.12' })

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert: zod regex rejects before any Redis/DB call is made
		expect(res.status).toBe(400)
		expect(data.error).toBe('Invalid site ID')
		expect(checkRateLimit).not.toHaveBeenCalled()
	})

	it('TC-F04.CS.14 — Leading-zero-padded siteId collapses to the same canonical rate-limit key (bypass regression)', async () => {
		// Arrange: '1' and '01' are the same site (Postgres implicit int cast: '01'::int = 1)
		// but are different strings — the key must be built from the canonicalized number,
		// not the raw string, or an attacker could pad zeros for unlimited extra buckets.
		const req1 = makeReq(validBody({ siteId: '1' }), { xff: '13.13.13.13' })
		const req2 = makeReq(validBody({ siteId: '01' }), { xff: '13.13.13.13' })

		// Act
		const res1 = await POST(req1)
		const res2 = await POST(req2)

		// Assert: both requests hit the SAME rate-limit key (canonical numeric form)
		expect(res1.status).toBe(200)
		expect(res2.status).toBe(200)
		expect(checkRateLimit).toHaveBeenCalledWith('contact-submit:1:13.13.13.13', 5, 5 * 60 * 1000, { failClosed: true }) // TC-PERF-159: fail-closed (emails the owner)
		expect(checkRateLimit).not.toHaveBeenCalledWith(
			expect.stringContaining(':01:'),
			expect.anything(),
			expect.anything(),
		)
	})

	it('TC-F04.CS.31 — GH-2157: banned/expired store → 400, no lead saved, owner not notified', async () => {
		const payloadModule = await import('payload')
		const mockPayload = await payloadModule.getPayload({} as never)
		mockStoreUnavailable.mockResolvedValueOnce(true)
		mockNotifyContactLead.mockClear()

		const res = await POST(makeReq(validBody(), { xff: '1.1.1.31' }))

		expect(res.status).toBe(400)
		expect(mockPayload.create).not.toHaveBeenCalled()
		expect(mockNotifyContactLead).not.toHaveBeenCalled()
	})

	it('TC-F04.CS.15 — siteId exceeding Postgres int4 range → 400 before rate-limit/DB lookup', async () => {
		// Arrange: all-digit string passes the regex but overflows a Postgres int4 PK
		const body = validBody({ siteId: '99999999999999999999' })
		const req = makeReq(body, { xff: '14.14.14.14' })

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert: rejected before touching Redis/DB, not silently truncated or DB-erroring
		expect(res.status).toBe(400)
		expect(data.error).toBe('Invalid site ID')
		expect(checkRateLimit).not.toHaveBeenCalled()
	})

	it('TC-F04.CS.16 — siteId of "0" → 400 (not a valid positive PK)', async () => {
		// Arrange
		const body = validBody({ siteId: '0' })
		const req = makeReq(body, { xff: '15.15.15.15' })

		// Act
		const res = await POST(req)
		const data = await res.json()

		// Assert
		expect(res.status).toBe(400)
		expect(data.error).toBe('Invalid site ID')
		expect(checkRateLimit).not.toHaveBeenCalled()
	})
})
