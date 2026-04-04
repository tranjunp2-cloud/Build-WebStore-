import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addCustomDomain, verifyCustomDomain, removeCustomDomain } from '@/app/(dashboard)/settings/domains/actions';
import * as dns from 'dns';

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

vi.mock('dns', () => {
    return {
        promises: {
            resolve4: vi.fn(),
        }
    }
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── TC-F19.01 Add / TC-F19.02 Remove / TC-F19.03 Verify ──
describe('Domains Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('DO_API_TOKEN', 'mock-token');
        vi.stubEnv('DO_APP_ID', 'mock-app-id');
        vi.stubEnv('SERVER_IP', '162.159.140.98,172.66.0.96');
        
        mockTenantId = 'tenant-123';
        mockFindByID.mockResolvedValue({ id: 'tenant-123', customDomains: [] });
        mockFind.mockResolvedValue({ docs: [] });
        mockUpdate.mockResolvedValue({});
        
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('addCustomDomain', () => {
        it('TC-F19.01a: returns error for invalid domain formats', async () => {
            const res = await addCustomDomain('https://invalid.com/path');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/Invalid domain format/i);
        });

        it('TC-F19.01b: blocks adding domains already in use by another tenant', async () => {
            mockFind.mockResolvedValueOnce({ docs: [{ id: 'other-tenant' }] });
            const res = await addCustomDomain('example.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/already registered by another store/i);
        });

        it('TC-F19.01c: adds domain to Payload and DO API spec successfully', async () => {
            // Mock DO GET App Spec response (missing the domain currently)
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    app: { spec: { domains: [] } }
                })
            });
            // Mock DO PUT success
            mockFetch.mockResolvedValueOnce({ ok: true });

            const res = await addCustomDomain('new-store.com');
            expect(res.success).toBe(true);
            
            // Should call payload.update to add 'pending' domain
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                data: {
                    customDomains: [{ domain: 'new-store.com', status: 'pending' }]
                }
            }));

            // Should call DO API PUT
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenNthCalledWith(2, 
                expect.stringContaining('/mock-app-id'), 
                expect.objectContaining({ method: 'PUT' })
            );
        });
    });

    describe('removeCustomDomain', () => {
        it('TC-F19.02a: removes domain from DB and DO spec', async () => {
            mockFindByID.mockResolvedValueOnce({ 
                id: 'tenant-123', 
                customDomains: [{ domain: 'remove-me.com', status: 'active' }] 
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    app: { spec: { domains: [{ domain: 'remove-me.com', type: 'ALIAS' }] } }
                })
            });
            // Mock PUT
            mockFetch.mockResolvedValueOnce({ ok: true });

            const res = await removeCustomDomain('remove-me.com');
            expect(res.success).toBe(true);
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                data: { customDomains: [] } // removed
            }));
            
            // Ensure DO PUT body has domains array without removed one
            const putCall = mockFetch.mock.calls[1];
            expect(putCall[1].body).toContain('"domains":[]');
        });
    });

    describe('verifyCustomDomain', () => {
        it('TC-F19.03a: returns DNS mismatch error if IPs do not match server', async () => {
            const mockedDnsResolve4 = vi.mocked(dns.promises.resolve4);
            mockedDnsResolve4.mockResolvedValueOnce(['1.1.1.1']); // Not the standard server IP

            const res = await verifyCustomDomain('check-me.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/DNS mismatch/i);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('TC-F19.03b: returns SSL provisioning error if DO API phase is not ACTIVE or domain missing', async () => {
            const mockedDnsResolve4 = vi.mocked(dns.promises.resolve4);
            mockedDnsResolve4.mockResolvedValueOnce(['162.159.140.98']); // Valid IP

            // Mock DO App API returning an empty domains array (missing) or pending
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    app: { domains: [{ spec: { domain: 'check-me.com' }, phase: 'PENDING' }] }
                })
            });

            const res = await verifyCustomDomain('check-me.com');
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/SSL Provisioning is still in progress/i);
        });

        it('TC-F19.03c: falls back to success if DO API fetch fails (500 internal)', async () => {
            const mockedDnsResolve4 = vi.mocked(dns.promises.resolve4);
            mockedDnsResolve4.mockResolvedValueOnce(['162.159.140.98']); // Valid IP

            mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

            const res = await verifyCustomDomain('check-me.com');
            expect(res.success).toBe(true); // Fallback behavior
            expect(mockUpdate).toHaveBeenCalled();
        });

        it('TC-F19.03d: succeeds perfectly when DNS is correct and DO phase is ACTIVE', async () => {
            const mockedDnsResolve4 = vi.mocked(dns.promises.resolve4);
            mockedDnsResolve4.mockResolvedValueOnce(['162.159.140.98']); // Valid IP

            mockFindByID.mockResolvedValueOnce({ 
                id: 'tenant-123', 
                customDomains: [{ domain: 'check-me.com', status: 'pending' }] 
            });

            // Mock DO App API returning ACTIVE
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    app: { domains: [{ spec: { domain: 'check-me.com' }, phase: 'ACTIVE' }] }
                })
            });

            const res = await verifyCustomDomain('check-me.com');
            expect(res.success).toBe(true);

            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                data: { customDomains: [{ domain: 'check-me.com', status: 'active' }] }
            }));
        });
    });
});
