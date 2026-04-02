"use server";

import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';
import { getCurrentTenantId } from '@/lib/auth';

export async function getPaymentSettings() {
    try {
        const payload = await getPayloadHMR({ config: configPromise });
        const tenantId = await getCurrentTenantId();
        
        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        const tenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
        });

        return { success: true, payments: tenant.payments || {} };
    } catch (error: any) {
        console.error("Failed to get payment settings via action:", error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}

export async function updatePaymentSettings(updates: any) {
    try {
        const payload = await getPayloadHMR({ config: configPromise });
        const tenantId = await getCurrentTenantId();
        
        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                payments: updates,
            },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Failed to update payment settings via action:", error);
        return { success: false, error: error.message || 'Unknown error occurred while saving payment settings.' };
    }
}

export async function uploadQrMedia(formData: FormData) {
    try {
        const payload = await getPayloadHMR({ config: configPromise });
        const tenantId = await getCurrentTenantId();
        
        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant session found.' };
        }

        const file = formData.get('file') as File;
        if (!file) return { success: false, error: 'No file provided' };

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
    } catch (error: any) {
        console.error("Media upload action error:", error);
        return { success: false, error: error.message || "Failed to upload media via server action" };
    }
}
