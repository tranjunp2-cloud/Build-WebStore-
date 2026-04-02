import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPaymentSettings, updatePaymentSettings, uploadQrMedia } from '@/app/(dashboard)/settings/payments/actions';
import { getCurrentTenantId } from '@/lib/auth';
import { getPayloadHMR } from '@payloadcms/next/utilities';

// --- Arrange: Mocks ---
vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn(),
}));

vi.mock('@payloadcms/next/utilities', () => ({
    getPayloadHMR: vi.fn(),
}));

vi.mock('@payload-config', () => ({
    default: Promise.resolve({}),
}));

describe('Payment Actions', () => {
    let mockPayloadContext: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPayloadContext = {
            findByID: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        };

        (getPayloadHMR as any).mockResolvedValue(mockPayloadContext);
    });

    describe('getPaymentSettings', () => {
        it('should return unauthorized error if no session tenant', async () => {
            // Arrange
            (getCurrentTenantId as any).mockResolvedValue(null);

            // Act
            const result = await getPaymentSettings();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Unauthorized/);
        });

        it('should return payments config on success', async () => {
            // Arrange
            (getCurrentTenantId as any).mockResolvedValue('tenant-123');
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
            (getCurrentTenantId as any).mockResolvedValue('tenant-123');
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
            (getCurrentTenantId as any).mockResolvedValue(null);

            // Act
            const result = await updatePaymentSettings({ payment_cod: true });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Unauthorized/);
            expect(mockPayloadContext.update).not.toHaveBeenCalled();
        });

        it('should update tenant on success', async () => {
            // Arrange
            (getCurrentTenantId as any).mockResolvedValue('tenant-123');
            mockPayloadContext.update.mockResolvedValue({});

            // Act
            const result = await updatePaymentSettings({ payment_cod: true });

            // Assert
            expect(result.success).toBe(true);
            expect(mockPayloadContext.update).toHaveBeenCalledWith({
                collection: 'tenants',
                id: 'tenant-123',
                data: { payments: { payment_cod: true } },
            });
        });
    });

    describe('uploadQrMedia', () => {
        it('should return unauthorized error if no session tenant', async () => {
            // Arrange
            (getCurrentTenantId as any).mockResolvedValue(null);
            const formData = new FormData();

            // Act
            const result = await uploadQrMedia(formData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Unauthorized/);
        });

        it('should block file larger than 2MB', async () => {
            // Arrange
            (getCurrentTenantId as any).mockResolvedValue('tenant-123');
            
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
            (getCurrentTenantId as any).mockResolvedValue('tenant-123');
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
            (getCurrentTenantId as any).mockResolvedValue('tenant-123');
            const formData = new FormData();
            const validImage = new File(['binary-content'], 'test.png', { type: 'image/png' });
            formData.append('file', validImage);

            const mockCreatedDoc = { id: 123, url: '/media/test.png' };
            mockPayloadContext.create.mockResolvedValue(mockCreatedDoc);

            // Act
            const result = await uploadQrMedia(formData);

            // Assert
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
