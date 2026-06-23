"use server";

import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentTenantId } from '@/lib/auth';
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription';
import type { PlanCode } from '@/collections/PlanSubscriptions';
import { deauthorizeStripeAccount } from '@/lib/payment/stripe';
import { xenditFetch, XenditError } from '@/lib/payment/xendit-client'
import { setCallbackUrl } from '@/lib/payment/xendit';

export type PaymentUpdates = {
    payment_cod?: boolean;
    payment_qr?: boolean;
    qr_image?: string | number | null;
    payment_card?: boolean;
    payment_fpx?: boolean;
    account_holder_name?: string | null;
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

        const sub = await getActivePlanSubscription(payload, tenantId);
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'payment_integration')) {
            return { success: false, error: 'Payment integration is not available on your current plan.' };
        }

        // Whitelist and validate fields, then send nested under payments group
        const paymentsData: Record<string, any> = {}

        if (updates.payment_cod !== undefined) {
            if (typeof updates.payment_cod === 'boolean') {
                paymentsData.payment_cod = updates.payment_cod;
            } else {
                return { success: false, error: 'Invalid type for payment_cod. Expected boolean.' };
            }
        }

        if (updates.payment_qr !== undefined) {
            if (typeof updates.payment_qr === 'boolean') {
                paymentsData.payment_qr = updates.payment_qr;
            } else {
                return { success: false, error: 'Invalid type for payment_qr. Expected boolean.' };
            }
        }

        if (updates.qr_image !== undefined) {
            if (updates.qr_image !== null) {
                // Verify the media was uploaded by this tenant (alt field tagged at upload time)
                const media = await payload.findByID({ collection: 'media', id: updates.qr_image as string });
                if (!media || (media as any).alt !== `qr-${tenantId}`) {
                    return { success: false, error: 'Invalid media: not uploaded by this tenant.' };
                }
            }
            paymentsData.qr_image = updates.qr_image;
        }

        if (updates.payment_card !== undefined) {
            if (typeof updates.payment_card === 'boolean') {
                paymentsData.payment_card = updates.payment_card;
            } else {
                return { success: false, error: 'Invalid type for payment_card. Expected boolean.' };
            }
        }

        if (updates.payment_fpx !== undefined) {
            if (typeof updates.payment_fpx === 'boolean') {
                paymentsData.payment_fpx = updates.payment_fpx;
            } else {
                return { success: false, error: 'Invalid type for payment_fpx. Expected boolean.' };
            }
        }

        if (updates.account_holder_name !== undefined) {
            if (updates.account_holder_name === null) {
                paymentsData.account_holder_name = null;
            } else if (typeof updates.account_holder_name === 'string' && updates.account_holder_name.length <= 150) {
                paymentsData.account_holder_name = updates.account_holder_name;
            } else {
                return { success: false, error: 'Invalid account_holder_name: must be string, max 150 chars.' };
            }
        }

        if (updates.bank_name !== undefined) {
            if (updates.bank_name === null) {
                paymentsData.bank_name = null;
            } else if (typeof updates.bank_name === 'string' && updates.bank_name.length <= 100) {
                paymentsData.bank_name = updates.bank_name;
            } else {
                return { success: false, error: 'Invalid bank_name: must be string, max 100 chars.' };
            }
        }

        if (updates.account_number !== undefined) {
            if (updates.account_number === null) {
                paymentsData.account_number = null;
            } else if (typeof updates.account_number === 'string' && updates.account_number.length <= 50) {
                paymentsData.account_number = updates.account_number;
            } else {
                return { success: false, error: 'Invalid account_number: must be string, max 50 chars.' };
            }
        }

        if (Object.keys(paymentsData).length === 0) {
            return { success: false, error: 'No valid payment fields provided' };
        }

        // Defence in depth: ensure at least one method stays active after this update.
        // Must merge with current DB state because paymentsData is a partial update.
        const currentTenant = await payload.findByID({ collection: 'tenants', id: tenantId });
        const currentPayments = (currentTenant as any).payments || {};
        const effective = {
            payment_cod: currentPayments.payment_cod ?? false,
            payment_qr: currentPayments.payment_qr ?? false,
            payment_card: currentPayments.payment_card ?? false,
            payment_fpx: currentPayments.payment_fpx ?? false,
            ...paymentsData,
        };
        if (!effective.payment_cod && !effective.payment_qr && !effective.payment_card && !effective.payment_fpx) {
            return { success: false, error: 'At least one payment method must remain active.' };
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { payments: paymentsData } as any,
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
                // Embed tenantId in alt to enable ownership verification in updatePaymentSettings
                alt: `qr-${tenantId}`,
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

// Model C: save merchant's own Xendit API keys
export async function saveXenditKeys(secretKey: string, callbackToken: string) {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) return { success: false, error: 'Unauthorized' };
        if (!secretKey || !callbackToken) return { success: false, error: 'Both Secret Key and Callback Token are required.' };
        if (!secretKey.startsWith('xnd_')) return { success: false, error: 'Invalid Secret Key format. Must start with xnd_' };
        if (secretKey.length > 512 || callbackToken.length > 512) return { success: false, error: 'Key length exceeds maximum allowed.' };

        const sub = await getActivePlanSubscription(payload, tenantId);
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'payment_integration')) {
            return { success: false, error: 'Payment integration is not available on your current plan.' };
        }

        // Permission check using the same Invoice API endpoint called during actual checkout.
        // Xendit enforces permissions on /v2/invoices before body validation:
        //   401 = invalid key → hard block
        //   403 = missing Money-in permission → hard block
        //   400/422/other = key valid + has permission, Xendit rejected the minimal test payload → proceed
        try {
            await xenditFetch('/v2/invoices', {
                method: 'POST',
                body: { external_id: '_perm_check', amount: -1 },
                apiKey: secretKey.trim(),
            });
        } catch (err: unknown) {
            if (err instanceof XenditError) {
                if (err.status === 401) {
                    return { success: false, error: 'Invalid Secret Key — please copy it again from your Xendit dashboard.' };
                }
                if (err.status === 403) {
                    return { success: false, error: 'This Secret Key is missing "Money-in products → Write" permission. Please re-create the key with that permission enabled in Xendit.' };
                }
                // 400/422/other = key valid + has permission, minimal payload rejected as expected → proceed
            }
            // Network or unexpected error → proceed silently
        }

        // Register ECH's webhook URL on merchant's Xendit account and validate callbackToken.
        // POST /callback_urls/invoice returns callback_token = merchant's Webhook Verification Token.
        // Comparing it against input catches wrong tokens before they break payment webhooks.
        const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')
        const webhookUrl = `${serverUrl}/api/webhooks/xendit`
        console.log('[saveXenditKeys] registering webhook URL:', webhookUrl)
        try {
            const cbResult = await setCallbackUrl('invoice', webhookUrl, secretKey.trim())
            if (cbResult.callback_token !== callbackToken.trim()) {
                return { success: false, error: 'Webhook Verification Token không đúng — vui lòng kiểm tra lại trong Xendit Dashboard (Settings → Configuration → Webhook verification token).' }
            }
        } catch (cbErr: unknown) {
            const xenditMsg = cbErr instanceof Error ? cbErr.message : String(cbErr)
            const xenditRaw = (cbErr as any)?.raw
            console.error('[saveXenditKeys] setCallbackUrl failed:', xenditMsg, '| raw:', JSON.stringify(xenditRaw))
            console.error('[saveXenditKeys] webhookUrl was:', webhookUrl)
            return { success: false, error: `Không thể đăng ký webhook URL với Xendit: ${xenditMsg}` }
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { xenditSecretKey: secretKey.trim(), xenditCallbackToken: callbackToken.trim() } as any,
            overrideAccess: true,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('saveXenditKeys error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function disconnectXendit() {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) return { success: false, error: 'Unauthorized' };

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                xenditSecretKey: null,
                xenditCallbackToken: null,
            } as any,
            overrideAccess: true,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('disconnectXendit error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function disconnectStripe() {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
        const accountId = (tenant as any).stripeAccountId as string | null;

        if (accountId) {
            try {
                await deauthorizeStripeAccount(accountId);
            } catch (err) {
                // Non-fatal: revoke best-effort; still clear our DB record
                console.error('Stripe deauthorize failed (continuing disconnect):', err);
            }
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                stripeAccountId: null,
                stripeOnboardingComplete: false,
                payments: { payment_card: false, payment_fpx: false },
            } as any,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('Disconnect Stripe error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

