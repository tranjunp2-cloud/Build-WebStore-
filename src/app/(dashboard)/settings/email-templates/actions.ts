"use server"

import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import type { EmailTemplateType, EmailRecipient } from '@/lib/email/types'
import { resetEmailTemplateConfigAs, saveEmailTemplateConfigAs } from '@/lib/email/template-settings-service'
import type { VersionConflict } from '@/lib/save-version/save-version'

// NOTE: declared locally (not re-exported from the lib) — a `'use server'` file may only
// export async functions; `export type { … } from '…'` re-exports are rejected by the
// Turbopack build. Structurally identical to ContentFields in lib/email/template-default-fields.
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
    /** The row's `updatedAt` the editor loaded (null: it started from the default). See saveEmailTemplateConfigAs. */
    expectedUpdatedAt?: string | null
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

export async function saveEmailTemplateConfig(
    input: SaveEmailTemplateInput,
): Promise<{ success: boolean; error?: string; updatedAt?: string } & Partial<VersionConflict>> {
    try {
        const tenantId = await getCurrentTenantId()

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' }
        }

        // plan gate, critical-template rule, limits and the upsert are shared with the dashboard assistant
        const { success, error, after, ...conflict } = await saveEmailTemplateConfigAs({ tenantId }, input)
        if (error) return { success, error }
        if (conflict.code) return { success, ...conflict }
        return { success, updatedAt: after?.updatedAt }
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
        const tenantId = await getCurrentTenantId()

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' }
        }

        await resetEmailTemplateConfigAs({ tenantId }, templateType, recipient)
        return { success: true }
    } catch (error: unknown) {
        console.error('[resetEmailTemplateConfig] error:', error instanceof Error ? error.message : error)
        return { success: false, error: 'Internal server error' }
    }
}
