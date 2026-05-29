"use server"

import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import type { EmailTemplateType, EmailRecipient } from '@/lib/email/types'

// These templates cannot be disabled — security-critical flows
const CRITICAL_TYPES: EmailTemplateType[] = ['otp-verification', 'forgot-password', 'password-changed']

export interface ContentFields {
    subject?: string
    greeting?: string
    ctaLabel?: string
    closing?: string
}

export interface SaveEmailTemplateInput {
    templateType: EmailTemplateType
    recipient: EmailRecipient
    enabled: boolean
    contentEn: ContentFields
    contentMs?: ContentFields
}

export async function getEmailTemplateSettings(): Promise<{ success: boolean; rows?: any[]; error?: string }> {
    try {
        const payload = await getPayload({ config })
        const tenantId = await getCurrentTenantId()

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' }
        }

        const result = await payload.find({
            collection: 'email-template-settings',
            where: { tenant: { equals: tenantId } },
            limit: 100,
            depth: 0,
            overrideAccess: true,
        })

        return { success: true, rows: result.docs }
    } catch (error: unknown) {
        console.error('[getEmailTemplateSettings] error:', error instanceof Error ? error.message : error)
        return { success: false, error: 'Internal server error' }
    }
}

function validateContentFields(fields: ContentFields, label: string): string | null {
    if (fields.subject !== undefined && fields.subject.length > 200) {
        return `${label} subject exceeds 200 characters`
    }
    if (fields.ctaLabel !== undefined && fields.ctaLabel.length > 100) {
        return `${label} ctaLabel exceeds 100 characters`
    }
    if (fields.greeting !== undefined && fields.greeting.length > 500) {
        return `${label} greeting exceeds 500 characters`
    }
    if (fields.closing !== undefined && fields.closing.length > 2000) {
        return `${label} closing exceeds 2000 characters`
    }
    return null
}

export async function saveEmailTemplateConfig(
    input: SaveEmailTemplateInput,
): Promise<{ success: boolean; error?: string }> {
    try {
        const payload = await getPayload({ config })
        const tenantId = await getCurrentTenantId()

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' }
        }

        // Server-side guard: critical templates cannot be disabled
        if (CRITICAL_TYPES.includes(input.templateType) && !input.enabled) {
            return { success: false, error: 'Cannot disable critical template' }
        }

        // Validate field lengths
        const enError = validateContentFields(input.contentEn, 'contentEn')
        if (enError) return { success: false, error: enError }

        if (input.contentMs) {
            const msError = validateContentFields(input.contentMs, 'contentMs')
            if (msError) return { success: false, error: msError }
        }

        // Upsert: find existing row for (tenant, templateType, recipient)
        const existing = await payload.find({
            collection: 'email-template-settings',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { templateType: { equals: input.templateType } },
                    { recipient: { equals: input.recipient } },
                ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })

        const data = {
            tenant: Number(tenantId),
            templateType: input.templateType,
            recipient: input.recipient,
            enabled: input.enabled,
            contentEn: input.contentEn,
            contentMs: input.contentMs ?? {},
        }

        if (existing.docs.length > 0) {
            await payload.update({
                collection: 'email-template-settings',
                id: existing.docs[0].id,
                data,
                overrideAccess: true,
            })
        } else {
            try {
                await payload.create({
                    collection: 'email-template-settings',
                    data,
                    overrideAccess: true,
                })
            } catch (createErr: unknown) {
                // Concurrent save: unique constraint violation — re-fetch and update instead
                const isConstraintViolation = createErr instanceof Error && (
                    createErr.message.includes('unique') || createErr.message.includes('duplicate')
                )
                if (isConstraintViolation) {
                    const retry = await payload.find({
                        collection: 'email-template-settings',
                        where: {
                            and: [
                                { tenant: { equals: tenantId } },
                                { templateType: { equals: input.templateType } },
                                { recipient: { equals: input.recipient } },
                            ],
                        },
                        limit: 1,
                        depth: 0,
                        overrideAccess: true,
                    })
                    if (retry.docs.length > 0) {
                        await payload.update({
                            collection: 'email-template-settings',
                            id: retry.docs[0].id,
                            data,
                            overrideAccess: true,
                        })
                    } else {
                        throw createErr
                    }
                } else {
                    throw createErr
                }
            }
        }

        return { success: true }
    } catch (error: unknown) {
        console.error('[saveEmailTemplateConfig] error:', error instanceof Error ? error.message : error)
        return { success: false, error: 'Internal server error' }
    }
}

export async function resetEmailTemplateConfig(
    templateType: EmailTemplateType,
    recipient: EmailRecipient,
): Promise<{ success: boolean; error?: string }> {
    try {
        const payload = await getPayload({ config })
        const tenantId = await getCurrentTenantId()

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' }
        }

        const existing = await payload.find({
            collection: 'email-template-settings',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { templateType: { equals: templateType } },
                    { recipient: { equals: recipient } },
                ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })

        if (existing.docs.length > 0) {
            await payload.delete({
                collection: 'email-template-settings',
                id: existing.docs[0].id,
                overrideAccess: true,
            })
        }
        // If row doesn't exist, it's already at hardcoded default — no-op

        return { success: true }
    } catch (error: unknown) {
        console.error('[resetEmailTemplateConfig] error:', error instanceof Error ? error.message : error)
        return { success: false, error: 'Internal server error' }
    }
}
