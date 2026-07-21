import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getPaymentSettings, updatePaymentSettings, uploadQrMedia } from '@/app/(dashboard)/settings/payments/actions';
import { getCurrentTenantId } from '@/lib/auth';
import { getPayload } from 'payload';

// --- Arrange: Mocks ---
vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn(),
}));

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (
        _payload: unknown,
        _tenantId: string,
        operation: (req: { transactionID: string }) => Promise<unknown>,
    ) => operation({ transactionID: 'tx-1' })),
}));

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
    }),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}));

vi.mock('@payload-config', () => ({
    default: Promise.resolve({}),
}));

type MockPayload = { findByID: Mock; update: Mock; create: Mock };

describe('Payment Actions', () => {
    let mockPayloadContext: MockPayload;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPayloadContext = {
            findByID: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        };

        vi.mocked(getPayload).mockResolvedValue(mockPayloadContext as unknown as Awaited<ReturnType<typeof getPayload>>);
    });

    describe('getPaymentSettings', () => {
        it('should return unauthorized error if no session tenant', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue(null);

            // Act
            const result = await getPaymentSettings();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Unauthorized/);
        });

        it('should return payments config on success', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            mockPayloadContext.findByID.mockResolvedValue({
                payments: { payment_cod: true },
            });

            // Act
            const result = await getPaymentSettings();

            // Assert
            expect(result.success).toBe(true);
            expect(result.payments).toEqual({ payment_cod: true });
            expect(mockPayloadContext.findByID).toHaveBeenCalledWith({
                collection: 'tenants',
                id: 'tenant-123',
            });
        });

        it('should catch database errors and obscure them', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            mockPayloadContext.findByID.mockRejectedValue(new Error('DATABASE_CRASH'));

            // Act
            const result = await getPaymentSettings();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Internal server error'); // Protected error details
        });
    });

    describe('updatePaymentSettings', () => {
        it('should return unauthorized error if no session tenant', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue(null);

            // Act
            const result = await updatePaymentSettings({ payment_cod: true });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Unauthorized/);
            expect(mockPayloadContext.update).not.toHaveBeenCalled();
        });

        it('should update tenant on success', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            // Backend guard fetches current tenant to merge effective payment state
            mockPayloadContext.findByID.mockResolvedValue({ payments: {} });
            mockPayloadContext.update.mockResolvedValue({
                payments: {
                    payment_cod: true,
                    payment_qr: false,
                    payment_card: false,
                    payment_fpx: false,
                    qr_image: null,
                    account_holder_name: null,
                    bank_name: null,
                    account_number: null,
                },
            });

            // Act
            const result = await updatePaymentSettings({ payment_cod: true });

            // Assert
            expect(result.success).toBe(true);
            expect(result.payments).toEqual({
                payment_cod: true,
                payment_qr: false,
                payment_card: false,
                payment_fpx: false,
                qr_image: null,
                account_holder_name: null,
                bank_name: null,
                account_number: null,
            });
            expect(mockPayloadContext.update).toHaveBeenCalledWith({
                collection: 'tenants',
                id: 'tenant-123',
                data: { payments: { payment_cod: true } },
                req: { transactionID: 'tx-1' },
            });
        });

        it('should preserve unrelated payment methods by only writing submitted fields', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            mockPayloadContext.findByID.mockResolvedValue({
                payments: {
                    payment_cod: false,
                    payment_qr: true,
                    payment_card: true,
                    payment_fpx: false,
                },
            });
            mockPayloadContext.update.mockResolvedValue({
                payments: {
                    payment_cod: true,
                    payment_qr: true,
                    payment_card: true,
                    payment_fpx: false,
                },
            });

            // Act
            const result = await updatePaymentSettings({ payment_cod: true });

            // Assert
            expect(mockPayloadContext.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { payments: { payment_cod: true } },
            }));
            expect(result.success && result.payments).toEqual(expect.objectContaining({
                payment_cod: true,
                payment_qr: true,
                payment_card: true,
                payment_fpx: false,
            }));
        });

        it('blocks removing the QR image when QR is the only active method', async () => {
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            mockPayloadContext.findByID.mockResolvedValue({
                payments: {
                    payment_cod: false,
                    payment_qr: true,
                    payment_card: false,
                    payment_fpx: false,
                    qr_image: 42,
                },
            });

            const result = await updatePaymentSettings({ qr_image: null });

            expect(result).toEqual({
                success: false,
                error: 'At least one payment method must remain active.',
            });
            expect(mockPayloadContext.update).not.toHaveBeenCalled();
        });

        it('should return error if payment_cod is not a boolean', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');

            // Act
            const result = await updatePaymentSettings({ payment_cod: 'true' as any });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Invalid type for payment_cod/);
            expect(mockPayloadContext.update).not.toHaveBeenCalled();
        });

        it('should return error if no valid payment fields provided', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');

            // Act
            const result = await updatePaymentSettings({});

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/No valid payment fields provided/);
            expect(mockPayloadContext.update).not.toHaveBeenCalled();
        });
    });

    describe('uploadQrMedia', () => {
        it('should return unauthorized error if no session tenant', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue(null);
            const formData = new FormData();

            // Act
            const result = await uploadQrMedia(formData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Unauthorized/);
        });

        it('should block file larger than 2MB', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            
            // Mock a 3MB file
            const formData = new FormData();
            const bigFileMock = new File([new ArrayBuffer(3 * 1024 * 1024)], 'huge.png', { type: 'image/png' });
            formData.append('file', bigFileMock);

            // Act
            const result = await uploadQrMedia(formData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/File size exceeds 2MB limit/);
            expect(mockPayloadContext.create).not.toHaveBeenCalled();
        });

        it('should block non-image files', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            const formData = new FormData();
            const textFile = new File(['hello'], 'doc.txt', { type: 'text/plain' });
            formData.append('file', textFile);

            // Act
            const result = await uploadQrMedia(formData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Only JPEG and PNG/);
            expect(mockPayloadContext.create).not.toHaveBeenCalled();
        });

        it('should create media on valid image payload', async () => {
            // Arrange
            vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-123');
            const formData = new FormData();
            const validImage = new File(['binary-content'], 'test.png', { type: 'image/png' });
            validImage.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(10));
            formData.append('file', validImage);

            const mockCreatedDoc = { id: 123, url: '/media/test.png' };
            mockPayloadContext.create.mockResolvedValue(mockCreatedDoc);

            // Act
            const result = await uploadQrMedia(formData);

            // Assert
            if (!result.success) console.error(result.error, (result as any).detail);
            expect(result.success).toBe(true);
            expect(result.doc).toEqual(mockCreatedDoc);
            expect(mockPayloadContext.create).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'media',
                file: expect.objectContaining({
                    name: 'test.png',
                    mimetype: 'image/png',
                }),
            }));
        });
    });
});
