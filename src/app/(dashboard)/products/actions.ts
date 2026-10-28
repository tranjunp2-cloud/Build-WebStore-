'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { findDashboardProducts, findDashboardProductPage } from '@/lib/products/dashboard-product-list'
import { saveAiProduct, type AiProductSaveResult } from '@/lib/products/save-ai-product'
import { deleteProduct, saveProduct, updateProductField } from '@/lib/products/save-product'
import { withVersionGuard } from '@/lib/save-version/save-version'

// The validated create / update / status / trash logic lives in `lib/products/save-product.ts` and
// `lib/products/save-ai-product.ts`: they take an explicit { user, tenantId } so the AI copilot's approval
// step can call them too. The actions below read the session and delegate.

// A 'use server' module may only export async functions (Turbopack refuses type re-exports):
// import AiProductSaveResult / AiSaveErrorCode from '@/lib/products/save-ai-product'.

export async function getProductsPageAction(input: unknown = {}) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')
    const payload = await getPayload({ config: configPromise })
    return JSON.parse(JSON.stringify(await findDashboardProductPage(payload, user, input)))
}

export async function getProductsAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const docs = await findDashboardProducts(payload, user)
    return JSON.parse(JSON.stringify(docs))
}

// NOTE: not a pure read — fetching a product with `aiReviewPending: true` clears that flag
// as a side effect (opening the edit page counts as the merchant reviewing an AI draft; see
// below). Any future caller of this action, not just the edit page, will trigger that write.
export async function getProductAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.findByID({
        collection: 'products',
        id,
        user,
        depth: 1
    })

    // Opening the edit page counts as the merchant having reviewed an AI-generated draft —
    // clear the pending flag immediately rather than waiting for an explicit save.
    // Best-effort: this is a secondary side effect of what is otherwise a read. If the write
    // fails, the read must still succeed — callers (any future one, not just the edit page)
    // expect getProductAction to behave like a read and must not see a load failure just
    // because this flag-clear hiccuped.
    if (res?.aiReviewPending) {
        try {
            const cleared = await payload.update({
                collection: 'products',
                id,
                data: { aiReviewPending: false },
                user,
                overrideAccess: false,
            })
            res.aiReviewPending = false
            // the flag-clear is a write: the form's version is the one it left
            res.updatedAt = cleared.updatedAt
        } catch (err) {
            console.error('[getProductAction] failed to clear aiReviewPending', { id, err })
        }
    }

    return JSON.parse(JSON.stringify(res))
}

/** The dashboard's placeholder photo resolver (cookie-bound action), kept so manual saves behave as before. */
async function dashboardPlaceholderImageId() {
    const { getOrCreateCrateCartonIdAction } = await import('@/app/(dashboard)/actions/media')
    return getOrCreateCrateCartonIdAction()
}

async function sessionActor() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')
    return { user, tenantId: tenantIdForQuery(user) }
}

/** `expectedUpdatedAt`: the version the form loaded. Stale → `{ ok: false, code: 'VERSION_CONFLICT', current }`, nothing written. */
export async function saveProductAction(rawData: unknown, id?: string | number, expectedUpdatedAt?: string | null) {
    const actor = await sessionActor()
    return withVersionGuard(() => saveProduct(rawData, id, { ...actor, placeholderImageId: dashboardPlaceholderImageId, expectedUpdatedAt }))
}

/**
 * AI bulk-create boundary only (BulkCreateModal). Revalidates the selected category server-side and
 * replays a committed attempt instead of creating a duplicate.
 */
export async function saveAiProductAction(rawData: unknown, rawMetadata: unknown): Promise<AiProductSaveResult> {
    return saveAiProduct(rawData, rawMetadata, sessionActor, { placeholderImageId: dashboardPlaceholderImageId })
}

export async function updateProductFieldAction(id: string | number, data: unknown, expectedUpdatedAt?: string | null) {
    if (!id && id !== 0) throw new Error('Invalid product ID')
    const actor = await sessionActor()
    return withVersionGuard(() => updateProductField(id, data, actor, expectedUpdatedAt))
}

export async function deleteProductAction(id: string | number) {
    return deleteProduct(id, await sessionActor())
}
