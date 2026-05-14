"use server";

import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentTenantId } from '@/lib/auth';

export type PaymentUpdates = {
    payment_cod?: boolean;
    payment_qr?: boolean;
    qr_image?: string | number | null;
    payment_card?: boolean;
    payment_fpx?: boolean;
    bank_name?: string | null;
    account_number?: string | null;
};

export async function getPaymentSettings() {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        const tenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
        });

        return { success: true, payments: tenant.payments || {} };
    } catch (error: unknown) {
        console.error("Failed to get payment settings via action:", error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function updatePaymentSettings(updates: PaymentUpdates) {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        // Whitelist safe fields before saving
        const cleanUpdates: PaymentUpdates = {};

        if (updates.payment_cod !== undefined) {
            if (typeof updates.payment_cod === 'boolean') {
                cleanUpdates.payment_cod = updates.payment_cod;
            } else {
                return { success: false, error: 'Invalid type for payment_cod. Expected boolean.' };
            }
        }

        if (updates.payment_qr !== undefined) {
            if (typeof updates.payment_qr === 'boolean') {
                cleanUpdates.payment_qr = updates.payment_qr;
            } else {
                return { success: false, error: 'Invalid type for payment_qr. Expected boolean.' };
            }
        }

        if (updates.qr_image !== undefined) {
            cleanUpdates.qr_image = updates.qr_image;
        }

        if (updates.payment_card !== undefined) {
            if (typeof updates.payment_card === 'boolean') {
                cleanUpdates.payment_card = updates.payment_card;
            } else {
                return { success: false, error: 'Invalid type for payment_card. Expected boolean.' };
            }
        }

        if (updates.payment_fpx !== undefined) {
            if (typeof updates.payment_fpx === 'boolean') {
                cleanUpdates.payment_fpx = updates.payment_fpx;
            } else {
                return { success: false, error: 'Invalid type for payment_fpx. Expected boolean.' };
            }
        }

        if (updates.bank_name !== undefined) {
            if (updates.bank_name === null || typeof updates.bank_name === 'string') {
                cleanUpdates.bank_name = updates.bank_name;
            } else {
                return { success: false, error: 'Invalid type for bank_name. Expected string.' };
            }
        }

        if (updates.account_number !== undefined) {
            if (updates.account_number === null || typeof updates.account_number === 'string') {
                cleanUpdates.account_number = updates.account_number;
            } else {
                return { success: false, error: 'Invalid type for account_number. Expected string.' };
            }
        }

        if (Object.keys(cleanUpdates).length === 0) {
            return { success: false, error: 'No valid payment fields provided' };
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                payments: cleanUpdates,
            },
        });

        return { success: true };
    } catch (error: unknown) {
        console.error("Failed to update payment settings via action:", error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function uploadQrMedia(formData: FormData) {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant session found.' };
        }

        const file = formData.get('file') as File;
        if (!file) return { success: false, error: 'No file provided' };

        // Server-side validation
        if (file.size > 2 * 1024 * 1024) {
            return { success: false, error: 'File size exceeds 2MB limit.' };
        }
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            return { success: false, error: 'Only JPEG and PNG images are allowed.' };
        }

        // Convert the File to a Buffer for Payload CMS local API
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const media = await payload.create({
            collection: 'media',
            data: {
                alt: 'QR Code for Bank Transfer',
            },
            file: {
                data: buffer,
                name: file.name,
                size: file.size,
                mimetype: file.type,
            }
        });

        return { success: true, doc: media };
    } catch (error: unknown) {
        console.error("Media upload action error:", error);
        return { success: false, error: 'Internal server error' };
    }
}

/** Update card/FPX enabled flags on the site's paymentConfig (Stripe payment methods). */
export async function updateSitePaymentConfig(updates: { cardEnabled?: boolean; fpxEnabled?: boolean }) {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

        const sites = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 1,
        });

        const site = sites.docs[0];
        if (!site) {
            return { success: false, error: 'Site not found' };
        }

        await payload.update({
            collection: 'sites',
            id: site.id,
            data: { paymentConfig: updates } as any,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error("Failed to update site payment config:", error);
        return { success: false, error: 'Internal server error' };
    }
}
