import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── MOCKS AT TOP OF FILE (Rule #5) ──
vi.mock('@payload-config', () => ({ default: {} }));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const mockFindByID = vi.fn();
const mockFind = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@payloadcms/next/utilities', () => ({
    getPayloadHMR: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        find: mockFind,
        update: mockUpdate,
    }))
}));

let mockTenantId: string | null = 'tenant-123';
vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn(() => Promise.resolve(mockTenantId)),
}));

// Mock the Vercel domains client module. We keep the real VercelDomainsError
// class exported from domains.types so `instanceof` checks inside the action
// still work (the action imports the class, not a mocked copy).
vi.mock('@/lib/vercel/domains', () => ({
    addProjectDomain: vi.fn(),
    verifyProjectDomain: vi.fn(),
    getProjectDomain: vi.fn(),
    removeProjectDomain: vi.fn(),
    isMockMode: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/vercel/dns-check', () => ({
    checkDnsRouting: vi.fn().mockResolvedValue({ ok: true }),
    checkHttpsConnectivity: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}));

import {
    addCustomDomain,
    verifyCustomDomain,
    removeCustomDomain,
    setPrimaryDomain,
} from '@/app/(dashboard)/settings/domains/actions';
import {
    addProjectDomain,
    verifyProjectDomain,
    getProjectDomain,
    removeProjectDomain,
} from '@/lib/vercel/domains';
import { VercelDomainsError, type VercelDomain } from '@/lib/vercel/domains.types';

// ── Test helpers ────────────────────────────────────────────────────────────
function makeVercelDomain(overrides: Partial<VercelDomain> = {}): VercelDomain {
    return {
        name: 'example.com',
        apexName: 'example.com',
        projectId: 'prj_test',
        verified: true,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('Domains Server Actions (Vercel-backed)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // New env vars — post-DO migration.
        vi.stubEnv('VERCEL_TOKEN', 'test-token');
        vi.stubEnv('VERCEL_TEAM_ID', 'team_test');
        vi.stubEnv('VERCEL_PROJECT_ID', 'prj_test');

        mockTenantId = 'tenant-123';
        mockFindByID.mockResolvedValue({ id: 'tenant-123', customDomains: [] });
        mockFind.mockResolvedValue({ docs: [] });
        mockUpdate.mockResolvedValue({});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    // ── addCustomDomain ─────────────────────────────────────────────────────
    describe('addCustomDomain', () => {
        // TC-A-01 — SSRF fuzz. Two groups:
        //   (a) Inputs that fail validation outright → Vercel NEVER called.
        //   (b) Inputs that URL-parse to a benign hostname → sanitizer strips
        //       the malicious parts, so Vercel only ever sees the safe form.
        // Both groups protect against SSRF; we assert the end result is that
        // no fragment/path/port/query/userinfo chars ever reach Vercel.
        it('TC-A-01: rejects raw SSRF payloads outright', async () => {
            const rawInvalid = [
                '192.168.1.1', // numeric TLD
                '',            // empty
                'not a domain', // whitespace
            ];
            for (const input of rawInvalid) {
                const res = await addCustomDomain(input);
                expect(res.success).toBe(false);
                expect(res.error).toMatch(/invalid domain format/i);
            }
            expect(vi.mocked(addProjectDomain)).not.toHaveBeenCalled();
        });

        it('TC-A-01b: sanitizer strips SSRF segments (path/port/query/fragment) before Vercel call', async () => {
            // URL parser + regex combo normalizes these to `mystore.com`.
            // Vercel must only ever see the clean apex, never the attack payload.
            vi.mocked(addProjectDomain).mockResolvedValue(
                makeVercelDomain({ name: 'mystore.com', apexName: 'mystore.com', verified: true }),
            );

            const dirty = [
                'mystore.com#@evil.com',
                'mystore.com:8080',
                'mystore.com/path',
                'mystore.com?x=1',
            ];
            for (const input of dirty) {
                // Reset per-iteration state so the in-tenant dup check doesn't fire.
                mockFindByID.mockResolvedValue({ id: 'tenant-123', customDomains: [] });
                mockFind.mockResolvedValue({ docs: [] });
                await addCustomDomain(input);
            }

            // Every invocation must have received the clean hostname — not the raw input.
            const calls = vi.mocked(addProjectDomain).mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            for (const [domainArg] of calls) {
                expect(domainArg).toBe('mystore.com');
                // Defense-in-depth: reject the attack characters outright.
                expect(domainArg).not.toMatch(/[#@:?/]/);
            }
        });

        // Cross-tenant pre-check (defense-in-depth before Vercel's 409).
        it('blocks domains already owned by another tenant', async () => {
            mockFind.mockResolvedValueOnce({ docs: [{ id: 'other-tenant' }] });
            const res = await addCustomDomain('example.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/already registered by another store/i);
            expect(vi.mocked(addProjectDomain)).not.toHaveBeenCalled();
        });

        // TC-A-02 — Happy path: even when Vercel returns verified=true, domain is always saved as pending.
        // BUG-F19 fix: DNS routing not confirmed at add time — Verify button must be clicked.
        it('TC-A-02: happy path always persists status=pending even when verified=true', async () => {
            vi.mocked(addProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({ name: 'new-store.com', apexName: 'new-store.com', verified: true }),
            );

            const res = await addCustomDomain('new-store.com');
            expect(res.success).toBe(true);
            expect(vi.mocked(addProjectDomain)).toHaveBeenCalledWith('new-store.com');

            // Always pending — vercelDomainId still saved for future verify calls.
            const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0];
            expect(finalUpdate.data.customDomains).toEqual([
                expect.objectContaining({
                    domain: 'new-store.com',
                    status: 'pending',
                    vercelDomainId: 'new-store.com',
                }),
            ]);
        });

        // TC-A-03 — Pending path with verification[] (TXT challenge).
        it('TC-A-03: pending path persists verification[] on tenant row', async () => {
            const verification = [
                {
                    type: 'TXT' as const,
                    domain: '_vercel.new-store.com',
                    value: 'vc-domain-verify-xyz',
                    reason: 'conflict',
                },
            ];
            vi.mocked(addProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({
                    name: 'new-store.com',
                    apexName: 'new-store.com',
                    verified: false,
                    verification,
                }),
            );

            const res = await addCustomDomain('new-store.com');
            expect(res.success).toBe(true);
            expect(res.verification).toEqual(verification);

            const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0];
            expect(finalUpdate.data.customDomains[0]).toMatchObject({
                domain: 'new-store.com',
                status: 'pending',
                vercelVerification: verification,
            });
        });

        // TC-A-03b — verified=false, verification=[] (no TXT needed — DNS-only pending).
        // Vercel registers the domain but DNS hasn't propagated yet; no ownership
        // TXT is required. UI should show only A/CNAME card, no TxtChallengeCard.
        it('TC-A-03b: verified=false with empty verification[] saved as pending without TXT challenge', async () => {
            vi.mocked(addProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({
                    name: 'shop.mystore.com',
                    apexName: 'mystore.com',
                    verified: false,
                    verification: [],
                }),
            );

            const res = await addCustomDomain('shop.mystore.com');
            expect(res.success).toBe(true);
            // No verification hints returned — UI must NOT show TxtChallengeCard.
            expect(res.verification).toBeUndefined();

            const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0];
            expect(finalUpdate.data.customDomains[0]).toMatchObject({
                domain: 'shop.mystore.com',
                status: 'pending',
                vercelVerification: null,
            });
        });

        // TC-A-04 — Vercel 409 conflict maps to a friendly error and the optimistic
        // row is rolled back.
        it('TC-A-04: rolls back optimistic Payload row on Vercel 409', async () => {
            vi.mocked(addProjectDomain).mockRejectedValueOnce(
                new VercelDomainsError({
                    status: 409,
                    code: 'domain_already_in_use',
                    message: 'Domain taken',
                }),
            );

            const res = await addCustomDomain('conflict.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/already registered by another store/i);

            // mockUpdate called twice: once for optimistic pending, once to roll back
            // to the prior (empty) list.
            expect(mockUpdate).toHaveBeenCalledTimes(2);
            const rollback = mockUpdate.mock.calls[1]?.[0];
            expect(rollback.data.customDomains).toEqual([]);
        });

        // TC-A-12 (CRITICAL, scenario 5.1) — Reverse rollback: Vercel succeeded but
        // the final Payload persist failed. The action must call removeProjectDomain.
        it('TC-A-12: reverse-rollback calls removeProjectDomain on Payload persist failure', async () => {
            vi.mocked(addProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({ name: 'flaky.com', apexName: 'flaky.com', verified: true }),
            );

            // First update (optimistic) succeeds; second update (final) fails.
            mockUpdate
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('DB down'));

            const res = await addCustomDomain('flaky.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/temporarily unavailable/i);
            expect(vi.mocked(removeProjectDomain)).toHaveBeenCalledWith('flaky.com');
        });

        // TC-A-13 — IDN/punycode. The Vercel client must receive ASCII form.
        it('TC-A-13: IDN input is converted to punycode before Vercel call', async () => {
            vi.mocked(addProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({ name: 'xn--mnchen-3ya.de', apexName: 'xn--mnchen-3ya.de' }),
            );

            const res = await addCustomDomain('münchen.de');
            expect(res.success).toBe(true);
            // URL parser lower-cases and punycode-encodes the hostname.
            expect(vi.mocked(addProjectDomain)).toHaveBeenCalledWith('xn--mnchen-3ya.de');
        });
    });

    // ── removeCustomDomain ──────────────────────────────────────────────────
    describe('removeCustomDomain', () => {
        // TC-A-10 — Happy path.
        it('TC-A-10: removes domain from Payload and Vercel', async () => {
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'remove-me.com', status: 'active' }],
            });
            vi.mocked(removeProjectDomain).mockResolvedValueOnce(undefined);

            const res = await removeCustomDomain('remove-me.com');
            expect(res.success).toBe(true);
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ customDomains: [] }),
                }),
            );
            expect(vi.mocked(removeProjectDomain)).toHaveBeenCalledWith('remove-me.com');
        });

        // TC-A-11 — 404 from Vercel is treated as success (idempotent).
        it('TC-A-11: swallows Vercel 404 as success (idempotent)', async () => {
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'gone.com', status: 'active' }],
            });
            vi.mocked(removeProjectDomain).mockRejectedValueOnce(
                new VercelDomainsError({
                    status: 404,
                    code: 'not_found',
                    message: 'Domain not in project',
                }),
            );

            const res = await removeCustomDomain('gone.com');
            expect(res.success).toBe(true);
        });

        it('blocks removing the current primary domain', async () => {
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'primary.com', status: 'active', isPrimary: true }],
            });

            const res = await removeCustomDomain('primary.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/primary domain/i);
            expect(mockUpdate).not.toHaveBeenCalled();
            expect(vi.mocked(removeProjectDomain)).not.toHaveBeenCalled();
        });
    });

    // ── verifyCustomDomain ──────────────────────────────────────────────────
    describe('verifyCustomDomain', () => {
        // TC-A-07 — Happy: verified=true → DNS + HTTPS pass → status flipped to active.
        it('TC-A-07: happy path flips tenant row to status=active', async () => {
            // Initial read + re-fetch (zombie guard before Write-2)
            mockFindByID
                .mockResolvedValueOnce({
                    id: 'tenant-123',
                    customDomains: [{ domain: 'check-me.com', status: 'pending' }],
                })
                .mockResolvedValueOnce({
                    id: 'tenant-123',
                    customDomains: [{ domain: 'check-me.com', status: 'pending' }],
                });
            vi.mocked(verifyProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({ name: 'check-me.com', apexName: 'check-me.com', verified: true }),
            );

            const res = await verifyCustomDomain('check-me.com');
            expect(res.success).toBe(true);

            const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0];
            expect(finalUpdate.data.customDomains[0]).toMatchObject({
                domain: 'check-me.com',
                status: 'active',
            });
        });

        // TC-A-08 — Vercel 400 on /verify → action re-fetches via GET and surfaces
        // the fresh verification[].
        it('TC-A-08: on 400 re-fetches verification via getProjectDomain', async () => {
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'needs-txt.com', status: 'pending' }],
            });
            vi.mocked(verifyProjectDomain).mockRejectedValueOnce(
                new VercelDomainsError({
                    status: 400,
                    code: 'verification_failed',
                    message: 'TXT missing',
                }),
            );
            const freshVerification = [
                {
                    type: 'TXT' as const,
                    domain: '_vercel.needs-txt.com',
                    value: 'vc-domain-verify-abc',
                    reason: 'missing_txt',
                },
            ];
            vi.mocked(getProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({
                    name: 'needs-txt.com',
                    apexName: 'needs-txt.com',
                    verified: false,
                    verification: freshVerification,
                }),
            );

            const res = await verifyCustomDomain('needs-txt.com');
            expect(res.success).toBe(false);
            expect((res as { verification: unknown }).verification).toEqual(freshVerification);
            expect(vi.mocked(getProjectDomain)).toHaveBeenCalledWith('needs-txt.com');

            // Tenant row should have vercelVerification persisted.
            const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0];
            expect(finalUpdate.data.customDomains[0]).toMatchObject({
                domain: 'needs-txt.com',
                vercelVerification: freshVerification,
            });
        });

        // TC-A-08b — verifyProjectDomain resolves 200 with verified=false (not thrown).
        // Distinct from TC-A-08 (400 thrown). This path: Vercel says "not verified yet"
        // with a fresh TXT challenge in the body — action persists and surfaces it.
        it('TC-A-08b: verifyProjectDomain 200 verified=false persists fresh verification and returns error', async () => {
            const freshVerification = [
                { type: 'TXT' as const, domain: '_vercel.pending.com', value: 'vc-fresh-token', reason: 'pending_domain_verification' },
            ];
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'pending.com', status: 'pending' }],
            });
            vi.mocked(verifyProjectDomain).mockResolvedValueOnce(
                makeVercelDomain({ name: 'pending.com', apexName: 'pending.com', verified: false, verification: freshVerification }),
            );

            const res = await verifyCustomDomain('pending.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/verification failed/i);
            expect((res as { verification: unknown }).verification).toEqual(freshVerification);

            // Payload row updated with fresh verification challenges.
            const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0];
            expect(finalUpdate.data.customDomains[0]).toMatchObject({
                domain: 'pending.com',
                vercelVerification: freshVerification,
            });
            // getProjectDomain should NOT be called — no 400 error thrown.
            expect(vi.mocked(getProjectDomain)).not.toHaveBeenCalled();
        });

        // TC-A-09 — Idempotent: already-active domain short-circuits.
        it('TC-A-09: idempotent short-circuit when already active', async () => {
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'done.com', status: 'active' }],
            });

            const res = await verifyCustomDomain('done.com');
            expect(res.success).toBe(true);
            expect(vi.mocked(verifyProjectDomain)).not.toHaveBeenCalled();
        });

        // TC-S-01 — Cross-tenant ownership check (scenario 8.1).
        it('TC-S-01: rejects cross-tenant verify before calling Vercel', async () => {
            // Tenant row does NOT include attacker.com — tenant A attacking tenant B.
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'mine.com', status: 'pending' }],
            });

            const res = await verifyCustomDomain('not-mine.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/not found in your store/i);
            expect(vi.mocked(verifyProjectDomain)).not.toHaveBeenCalled();
        });

    });

    // ── setPrimaryDomain (unchanged — platform-agnostic) ────────────────────
    describe('setPrimaryDomain', () => {
        it('blocks setting a pending domain as primary', async () => {
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [{ domain: 'pending.com', status: 'pending' }],
            });

            const res = await setPrimaryDomain('pending.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/verified/i);
        });

        it('sets an active domain as primary successfully', async () => {
            mockFindByID.mockResolvedValueOnce({
                id: 'tenant-123',
                customDomains: [
                    { domain: 'old.com', status: 'active', isPrimary: true },
                    { domain: 'new.com', status: 'active', isPrimary: false },
                ],
            });

            const res = await setPrimaryDomain('new.com');
            expect(res.success).toBe(true);
            const finalUpdate = mockUpdate.mock.calls.at(-1)?.[0];
            expect(finalUpdate.data.customDomains).toEqual([
                expect.objectContaining({ domain: 'old.com', isPrimary: false }),
                expect.objectContaining({ domain: 'new.com', isPrimary: true }),
            ]);
        });
    });
});
