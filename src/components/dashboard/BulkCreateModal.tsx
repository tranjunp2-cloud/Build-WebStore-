'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Copy, ImageIcon, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import {
    saveAiProductAction,
    type AiProductSaveResult,
} from '@/app/(dashboard)/products/actions'
import { useI18n } from '@/i18n'
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

import { CategorySelect, type Category } from '@/components/dashboard/CategorySelect'

import { getOrCreateCrateCartonIdAction } from '@/app/(dashboard)/actions/media'
import { getCategoriesByIdsAction } from '@/app/(dashboard)/products/categories/actions'

interface VariantPayload {
    name: string
    price: number
    compareAtPrice?: number
    sku: string
    stock: number
}

interface ParsedProduct {
    _id: string // client-issued operation ID; stable across save/replay attempts and state updates
    _draftOrdinal: number // stable accessible-name discriminator within this parse result
    // No longer read — the review drawer removes an unwanted draft outright (removeProduct)
    // instead of a select/deselect checkbox. Left optional rather than deleted so existing
    // callers/fixtures that still set it don't need updating.
    selected?: boolean
    name: string
    price: number
    compareAtPrice?: number
    categoryId: string | number | null
    description?: string
    seoTitle?: string
    seoDescription?: string
    slug?: string
    sku?: string
    // Editable in the review drawer for non-variant products only — for products with variants,
    // the server recomputes `inventory` as the sum of variant stocks (Products.ts beforeChange
    // hook), so this value is ignored/overwritten and the field is shown disabled instead.
    stock?: number
    weight?: number
    length?: number
    width?: number
    height?: number
    variants: VariantPayload[]
    variantConfigs?: { name: string; options: { value: string }[] }[]
}

interface BulkCreateModalProps {
    onClose: () => void
    onPartialSuccess?: () => void
    onSuccess?: () => void
    initialPrompt?: string
    categories?: Category[]
}

type DraftSaveFailure = {
    code: string
    message: string
    retryable: boolean
    referenceId?: string
}

export function slugify(text: string) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Guarantees every AI-bulk-created product/variant has a non-empty SKU, even if the AI omits
// one \u2014 the publish gate (productPublishBlocks) blocks activation on a blank SKU.
export function generateFallbackSku(name: string) {
    const base = slugify(name).split('-').filter(Boolean).map(w => w.slice(0, 3)).join('').toUpperCase().slice(0, 8) || 'PRD'
    // toString(36) on a "round" float (e.g. 0.5 -> "0.i") can yield fewer than 4 chars after
    // substring — pad so the suffix is always exactly 4 chars, preserving collision-resistance.
    const suffix = Math.random().toString(36).substring(2, 6).padEnd(4, '0').toUpperCase()
    return `${base}-${suffix}`
}

function generateUniqueSku(name: string, usedSkus: Set<string>) {
    let sku = generateFallbackSku(name)
    for (let attempt = 0; usedSkus.has(sku.toLowerCase()); attempt++) {
        // Random suffixes make collisions extremely unlikely; this deterministic escape hatch
        // still guarantees progress if Math.random is mocked or an unlikely collision repeats.
        sku = attempt < 9
            ? generateFallbackSku(name)
            : `${slugify(name).slice(0, 16).toUpperCase() || 'PRD'}-${attempt + 1}`
    }
    usedSkus.add(sku.toLowerCase())
    return sku
}

const textToLexical = (text: string) => {
    if (!text) return undefined
    return {
        root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            children: text.split('\n\n').map(p => ({
                type: 'paragraph',
                format: '',
                indent: 0,
                version: 1,
                children: p ? [{ type: 'text', text: p, mode: 'normal', style: '', detail: 0, format: 0, version: 1,
                          },
                      ] : [],
            })),
        },
    }
}

function isAiSaveFailure(result: AiProductSaveResult): result is Extract<AiProductSaveResult, { ok: false }> {
    return result.ok === false
}

export function sanitizeXSS(text: string) {
    if (!text) return text
    let safe = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    return safe.replace(/<[^>]*>?/gm, '').trim()
}

// Untrusted AI output — a malformed/omitted numeric field parses to NaN via `Number(v)`, and
// `NaN ?? fallback` does NOT catch it (NaN is neither null nor undefined, unlike what `??`
// checks for), so a bare `Number(v ?? fallback)` still lets a raw NaN through into a
// controlled <input type="number">. Coerce with an explicit finiteness check instead.
function coerceFiniteNumber(value: unknown, fallback = 0): number {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

type VariantTierLabels = {
    first: string
    second: string
}

const DEFAULT_VARIANT_TIER_LABELS: VariantTierLabels = {
    first: 'Color',
    second: 'Size',
}

export function buildSavePayload(
    prod: ParsedProduct,
    cartonMediaId: string | number | null,
    categoryId: string | number | null,
    defaultVariantName: string = 'Default',
    tierLabels: VariantTierLabels = DEFAULT_VARIANT_TIER_LABELS) {
    const hasVariants = Boolean(prod.variants?.length)
    const baseSlug = slugify(prod.slug || prod.name) || 'product'
    const compactDraftId = prod._id?.replace(/-/g, '').toLowerCase()
    const stableDraftId = /^[a-f0-9]{32}$/.test(compactDraftId ?? '') ? compactDraftId : null
    // The generated UUID is persisted in the unique slug, giving retries a stable idempotency
    // key without adding a new Product field/schema migration. Legacy callers without a UUID
    // retain the existing random-suffix behaviour.
    const finalSlug = stableDraftId
        ? `${baseSlug}-ai-${stableDraftId}`
        : `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    // Force generation of variantConfigs from variant names to guarantee 100% option mapping accuracy
    // and correctly capture merged multi-tier options. We ignore AI's variantConfigs because they often
    // mismatch when tiers are clamped/merged.
    let variantConfigs: { name: string; options: { value: string }[] }[] | undefined = []
    if (hasVariants) {
        const splitVariants = prod.variants!.map(v => (v.name || defaultVariantName).split(' - '))
        const numTiers = Math.max(...splitVariants.map(v => v.length))
        const validNumTiers = Math.min(numTiers, 2) // DB schema limits to 2 tiers

        if (validNumTiers > 0) {
            variantConfigs = Array.from({ length: validNumTiers }).map((_, i) => ({
                name: i === 0 ? tierLabels.first : tierLabels.second,
                options: Array.from(
                    new Set(splitVariants.map(v => {
                        // Drop excess splits if AI provided too many
                        return (v[i] || '').trim()
                            }).filter(val => val !== ''))
                ).map(val => ({ value: val })),
            }))
        }
    }

    // Defensive clamping on variant names to prevent > 1 hyphen if user didn't correct it.
    // Case-insensitive name-uniqueness (guarding products_variants_name_parent_uniq — see
    // handleParse's uniqueMap above) is enforced earlier, at parse time, rather than here:
    // renaming a variant this late (post-parse, pre-save) would desync it from
    // buildVariantMatrix's exact-string tier-combo matching (variant-utils.ts) the next time
    // the merchant edits the tier matrix in ProductForm, silently resetting its price/sku/stock.
    let safeVariants = prod.variants
    if (hasVariants && safeVariants) {
        safeVariants = safeVariants.map(v => {
            const rawName = v.name || defaultVariantName
            const parts = rawName.split(' - ')
            if (parts.length > 2) {
                 // Truncate to maximum 2 tiers
                 return { ...v, name: `${parts[0].trim()} - ${parts[1].trim()}` }
            }
            return { ...v, name: rawName.trim() }
        })
    }

    let safeName = sanitizeXSS(prod.name).trim() || 'Product'
    if (safeName.length < 3) {
        safeName = safeName + ' (Bulk)'
    }

    // AI can repeat a SKU across variant rows (and Payload rejects them as a generic
    // "Variants" validation error). Reserve the base SKU first, then keep only unique
    // AI SKUs case-insensitively; regenerate missing or colliding variant values.
    const usedSkus = new Set<string>()
    const requestedBaseSku = sanitizeXSS(prod.sku || '').trim()
    const baseSku = requestedBaseSku && !usedSkus.has(requestedBaseSku.toLowerCase())
        ? requestedBaseSku
        : generateUniqueSku(safeName, usedSkus)
    usedSkus.add(baseSku.toLowerCase())

    const variants = hasVariants ? safeVariants!.map(v => {
        const variantPrice = Number(v.price || prod.price) || 0
        const compareAtPriceCandidate = v.compareAtPrice ?? prod.compareAtPrice
        const requestedSku = sanitizeXSS(v.sku || '').trim()
        const sku = requestedSku && !usedSkus.has(requestedSku.toLowerCase())
            ? requestedSku
            : generateUniqueSku(`${safeName}-${v.name || defaultVariantName}`, usedSkus)
        usedSkus.add(sku.toLowerCase())
        return {
            name: sanitizeXSS(v.name || defaultVariantName),
            price: variantPrice,
            compareAtPrice: compareAtPriceCandidate && Number(compareAtPriceCandidate) > variantPrice ? Number(compareAtPriceCandidate) : null,
            stock: coerceFiniteNumber(v.stock),
            sku,
        }
    }) : undefined

    return {
        name: safeName,
        slug: finalSlug,
        sku: baseSku,
        price: Number(prod.price) || 0,
        compareAtPrice: prod.compareAtPrice && Number(prod.compareAtPrice) > Number(prod.price) ? Number(prod.compareAtPrice) : null,
        description: prod.description ? textToLexical(sanitizeXSS(prod.description)) : undefined,
        status: 'draft',
        aiReviewPending: true,
        hasVariants,
        variantConfigs,
        category: categoryId != null ? [categoryId] : undefined,
        images: cartonMediaId ? [{ image: cartonMediaId, alt: sanitizeXSS(prod.name) }] : [],
        seo: {
            title: sanitizeXSS(prod.seoTitle || ''),
            description: sanitizeXSS(prod.seoDescription || ''),
        },
        dimensions: {
            length: Number(prod.length) || 0,
            width: Number(prod.width) || 0,
            height: Number(prod.height) || 0,
        },
        variants,
        // Server recomputes this as the sum of variant stocks for hasVariants products anyway
        // (Products.ts beforeChange hook overrides whatever is sent) — computed here too so the
        // payload is internally consistent with what the review drawer displayed (Stock there
        // edits every variant uniformly; base "inventory" = sum, matching VariantOptionsSection's
        // `setValue('baseInventory', total)` convention in the manual Add/Edit Product form).
        inventory: hasVariants ? safeVariants!.reduce((sum, v) => sum + coerceFiniteNumber(v.stock), 0) : coerceFiniteNumber(prod.stock),
        weight: prod.weight || 1, // Fallback for F14 dimension requirements
    }
}

export function BulkCreateModal({
    onClose,
    onPartialSuccess,
    onSuccess,
    initialPrompt = "",
    categories = [],
}: BulkCreateModalProps) {
    const { t, locale } = useI18n()
    const [isParsing, setIsParsing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [products, setProducts] = useState<ParsedProduct[]>([])
    const [generationId, setGenerationId] = useState<string | null>(null)
    const [saveFailures, setSaveFailures] = useState<Record<string, DraftSaveFailure>>({})
    const [saveAnnouncement, setSaveAnnouncement] = useState('')
    const [hasParsed, setHasParsed] = useState(false)
    const [canRetryParse, setCanRetryParse] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [invalidCategoryIds, setInvalidCategoryIds] = useState<Set<string>>(() => new Set())
    const availableCategories = useMemo(
        () => categories.filter(category => !invalidCategoryIds.has(String(category.id))),
        [categories, invalidCategoryIds],
    )
    const canonicalCategoryIds = useMemo(
        () => new Map(availableCategories.map(category => [String(category.id), category.id])),
        [availableCategories],
    )
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    // GH-1491 issue 1 audit: parent only mounts this component while the modal should be
    // open, so it's locked for this component's whole lifetime — no internal open/closed
    // state to gate on.
    useLockBodyScroll(true)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (mounted && initialPrompt && !hasParsed && !isParsing) {
            handleParse(initialPrompt)
        }
    }, [mounted, initialPrompt, hasParsed, isParsing])

    const handleParse = async (promptText: string) => {
        setIsParsing(true)
        setCanRetryParse(false)
        try {
            const res = await fetch('/api/ai/products-bulk-parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ promptText, locale }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(JSON.stringify(data))

            if (data.products && Array.isArray(data.products)) {
                const responseGenerationId = typeof data.generationId === 'string'
                    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.generationId)
                    ? data.generationId
                    : null
                if (!responseGenerationId) {
                    setGenerationId(null)
                    setProducts([])
                    toast.error(t.dashboard?.products?.bulkCreate?.parseInvalidData || 'Invalid products format received from AI')
                    return
                }
                const initProducts = data.products.map((rawProduct: ParsedProduct & { category?: unknown }, draftIndex: number) => {
                    // Discard the legacy name-based contract before spreading normalized data.
                    const { category: _legacyCategory, ...p } = rawProduct
                    const normalizedName = normalizeDraftProductName(p.name || '')
                    // Freeze the slug base so an explicit retry remains idempotent after a name edit.
                    const stableSlugBase = slugify(p.slug || normalizedName) || 'product'
                    let cleanedVariants = p.variants
                    if (cleanedVariants && cleanedVariants.length > 0) {
                        // Case-insensitive dedup — DB has a case-insensitive unique index
                        // (products_variants_name_parent_uniq on lower(name) per parent) that the
                        // app-level SKU pre-check never validates against. Keying by lowercase here
                        // (not just exact string) guarantees no case-differing duplicate ever reaches
                        // buildSavePayload/the DB in the first place, so there's no need to rename a
                        // saved row later — which would desync it from buildVariantMatrix's exact-
                        // string tier-combo matching (variant-utils.ts) and reset its custom
                        // price/sku/stock the next time the merchant edits the tier matrix.
                        const uniqueMap = new Map<string, NonNullable<ParsedProduct['variants']>[number]>()
                        cleanedVariants.forEach(v => {
                            const rawName = v.name || 'Default'
                            const parts = rawName.split(' - ')
                            const truncatedName = parts.slice(0, 2).map(s => s.trim()).join(' - ')
                            const key = truncatedName.toLowerCase()
                            if (!uniqueMap.has(key)) {
                                // Same untrusted-AI-input coercion as the top-level price/stock below —
                                // fixed here (parse time) so the drawer's per-variant Stock display
                                // (variants[0].stock) and buildSavePayload both see a clean value.
                                uniqueMap.set(key, { ...v, name: truncatedName, stock: coerceFiniteNumber(v.stock),
                                })
                            }
                        })
                        cleanedVariants = Array.from(uniqueMap.values())
                    }
                    return {
                        ...p,
                        name: normalizedName,
                        slug: stableSlugBase,
                        variants: cleanedVariants,
                        _id: crypto.randomUUID(),
                        _draftOrdinal: draftIndex + 1,
                        selected: true,
                        categoryId: typeof p.categoryId === 'string' || typeof p.categoryId === 'number' ? (canonicalCategoryIds.get(String(p.categoryId)) ?? null) : null,
                        // Untrusted AI output — the prompt asks for "0 if not specified", but the
                        // model can still omit/malform this on unparseable input (e.g. gibberish
                        // with no price/stock mentioned). Coerce here (not just later in
                        // buildSavePayload) so the review drawer's <input type="number"> never
                        // receives a raw non-numeric value as `value`.
                        price: coerceFiniteNumber(p.price),
                        stock: coerceFiniteNumber(p.stock),
                    }
                })
                setGenerationId(responseGenerationId)
                setSaveFailures({})
                setProducts(initProducts)
            } else {
                toast.error(t.dashboard?.products?.bulkCreate?.parseInvalidData || 'Invalid products format received from AI')
            }
        } catch (error) {
            const errBase = error as Error
            // Non-ok fetch responses throw JSON.stringify(data) (see the isSkuConflictError /
            // SKU-retry convention above) so 429's resetAt survives the throw — parse once here,
            // falling back to the raw message as the code when it isn't JSON (e.g. a network error).
            let parsed: { error?: string
                resetAt?: number
                retryable?: boolean } | null = null
            try {
                parsed = JSON.parse(errBase.message)
            } catch {
                parsed = null
            }
            const code = parsed?.error ?? errBase.message
            if (code === 'merchantLanguageMismatch' && parsed?.retryable === true) {
                setCanRetryParse(true)
            }

            let errMsg = t.dashboard?.products?.bulkCreate?.parseError || 'Failed to parse products summary'
            if (code === 'rateLimitExceeded') {
                // resetAt comes from an untrusted-in-principle JSON response — guard the same way
                // coerceFiniteNumber already guards untrusted AI numeric output above, so a
                // malformed/non-numeric resetAt degrades to "1 min" instead of showing "NaN min".
                const resetAt = coerceFiniteNumber(parsed?.resetAt, Date.now())
                const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60000))
                const tmpl = t.dashboard?.products?.bulkCreate?.rateLimitExceeded
                    || "You've used all your AI generation attempts this hour. Try again in {minutes} min."
                errMsg = tmpl.replace('{minutes}', String(minutes))
            } else if (code === 'aiQuotaExceeded') errMsg = t.dashboard?.products?.bulkCreate?.aiQuotaExceeded || 'AI system overloaded'
            else if (code === 'aiTimeout') errMsg = t.dashboard?.products?.bulkCreate?.aiTimeout || 'AI timeout'

            toast.error(errMsg)
        } finally {
            setIsParsing(false)
            setHasParsed(true)
        }
    }

    const categoryRequiredMessage = t.dashboard?.products?.form?.errors?.categoryRequired || 'Please select a category for every product'
    const isAvailableCategoryId = (categoryId: ParsedProduct['categoryId']) => categoryId != null && canonicalCategoryIds.has(String(categoryId))
    const hasMissingCategories = products.some(product => !isAvailableCategoryId(product.categoryId))
    const invalidateCategories = (categoryIds: Array<string | number>) => {
        const invalidIds = new Set(categoryIds.map(String))
        setInvalidCategoryIds(current => new Set([...current, ...invalidIds]))
        setProducts(current => current.map(product => (
            product.categoryId != null && invalidIds.has(String(product.categoryId))
                ? { ...product, categoryId: null }
                : product
        )))
    }

    const localizedFailureMessage = (failure: DraftSaveFailure) => {
        const copy = t.dashboard?.products?.bulkCreate
        switch (failure.code) {
            case 'PERSISTENCE_VERIFY_FAILED':
                return copy?.persistenceVerifyFailed || 'The saved product could not be verified. Retry to check for the existing draft.'
            case 'CATEGORY_BUSY_RETRY':
                return copy?.categoryBusy || 'This category is busy. Retry this draft in a moment.'
            case 'SKU_CONFLICT':
                return copy?.skuConflictExhausted || 'A generated SKU is already in use. Retry to generate a new one.'
            case 'NETWORK_AMBIGUOUS':
                return copy?.networkAmbiguous || 'The result could not be confirmed. Retry to check for the existing draft.'
            default:
                return failure.message || copy?.saveFailed || 'Failed to create products'
        }
    }

    const handleCopyReference = async (referenceId: string) => {
        try {
            await navigator.clipboard.writeText(referenceId)
            toast.success(t.dashboard?.products?.bulkCreate?.referenceCopied || 'Reference copied')
        } catch {
            toast.error(t.dashboard?.products?.bulkCreate?.copyReferenceFailed || 'Could not copy the reference')
        }
    }

    const handleSave = async (targetDraftId?: string) => {
        const targetProducts = targetDraftId
            ? products.filter(product => product._id === targetDraftId)
            : products
        if (targetProducts.length === 0) {
            toast.error(t.dashboard?.products?.bulkCreate?.saveEmptyError || 'Please select at least 1 product')
            return
        }
        if (targetProducts.some(product => !isAvailableCategoryId(product.categoryId))) {
            toast.error(categoryRequiredMessage)
            return
        }
        if (!generationId) {
            toast.error(t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to save products')
            return
        }

        const targetIds = new Set(targetProducts.map(product => product._id))
        setSaveFailures(current => {
            const next = { ...current }
            for (const id of targetIds) delete next[id]
            return next
        })
        setSaveAnnouncement('')
        setIsSaving(true)

        try {
            const selectedCategoryIds = targetProducts.map(product => product.categoryId!)
            let revalidatedCategories: { id: string | number }[]
            try {
                revalidatedCategories = await getCategoriesByIdsAction(selectedCategoryIds)
            } catch (error) {
                void error
                const failure: DraftSaveFailure = {
                    code: 'SAVE_FAILED',
                    message: t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to save products',
                    retryable: true,
                }
                setSaveFailures(current => {
                    const next = { ...current }
                    for (const product of targetProducts) next[product._id] = failure
                    return next
                })
                setSaveAnnouncement(t.dashboard?.products?.bulkCreate?.saveFailureSummary?.replace('{count}', String(targetProducts.length)) || `${targetProducts.length} drafts need attention.`)
                toast.error(failure.message)
                return
            }

            const categoryById = new Map(revalidatedCategories.map(category => [String(category.id), category.id]))
            const unavailableCategoryIds = new Set(
                selectedCategoryIds
                    .filter(categoryId => !categoryById.has(String(categoryId)))
                    .map(String),
            )
            if (unavailableCategoryIds.size > 0) {
                invalidateCategories(Array.from(unavailableCategoryIds))
                toast.error(categoryRequiredMessage)
                if (targetProducts.every(product => !categoryById.has(String(product.categoryId)))) {
                    const failure: DraftSaveFailure = {
                        code: 'CATEGORY_INVALID',
                        message: categoryRequiredMessage,
                        retryable: false,
                    }
                    setSaveFailures(current => {
                        const next = { ...current }
                        for (const product of targetProducts) next[product._id] = failure
                        return next
                    })
                    setSaveAnnouncement(t.dashboard?.products?.bulkCreate?.saveFailureSummary?.replace('{count}', String(targetProducts.length)) || `${targetProducts.length} drafts need attention.`)
                    return
                }
            }

            let cartonMediaId: string | number | null = null
            try {
                cartonMediaId = await getOrCreateCrateCartonIdAction()
            } catch (error) {
                void error
            }

            const savedDraftIds = new Set<string>()
            const nextFailures: Record<string, DraftSaveFailure> = {}
            const defaultVariantName = t.dashboard?.products?.bulkCreate?.table?.defaultVariant || 'Default'
            const tierLabels = {
                first: t.dashboard?.products?.form?.sections?.color || DEFAULT_VARIANT_TIER_LABELS.first,
                second: t.dashboard?.products?.form?.sections?.size || DEFAULT_VARIANT_TIER_LABELS.second,
            }

            for (const prod of targetProducts) {
                try {
                    const categoryId = categoryById.get(String(prod.categoryId))
                    if (categoryId == null) {
                        nextFailures[prod._id] = {
                            code: 'CATEGORY_INVALID',
                            message: categoryRequiredMessage,
                            retryable: false,
                        }
                        continue
                    }

                    let payload = buildSavePayload(prod, cartonMediaId, categoryId, defaultVariantName, tierLabels)
                    const MAX_SKU_ATTEMPTS = 3
                    let skuAttempt = 1

                    while (skuAttempt <= MAX_SKU_ATTEMPTS) {
                        let result: AiProductSaveResult
                        try {
                            result = await saveAiProductAction(payload, {
                                generationId,
                                operationId: prod._id,
                                skuAttempt,
                            })
                        } catch (error) {
                            void error
                            const failure: DraftSaveFailure = {
                                code: 'NETWORK_AMBIGUOUS',
                                message: t.dashboard?.products?.bulkCreate?.networkAmbiguous || 'The result could not be confirmed. Retry to check for the existing draft.',
                                retryable: true,
                                referenceId: prod._id,
                            }
                            nextFailures[prod._id] = failure
                            toast.error(`${prod.name}: ${failure.message}`)
                            break
                        }

                        if (result.ok === true) {
                            savedDraftIds.add(prod._id)
                            break
                        }

                        if (isAiSaveFailure(result) && result.code === 'SKU_CONFLICT' && skuAttempt < MAX_SKU_ATTEMPTS) {
                            skuAttempt++
                            const retrySkus = new Set<string>()
                            payload = {
                                ...payload,
                                sku: generateUniqueSku(payload.name, retrySkus),
                                variants: payload.variants?.map(variant => ({
                                    ...variant,
                                    sku: generateUniqueSku(`${payload.name}-${variant.name}`, retrySkus),
                                })),
                            }
                            continue
                        }

                        const failure: DraftSaveFailure = isAiSaveFailure(result)
                            ? {
                                code: result.code,
                                message: result.message,
                                retryable: result.retryable,
                                referenceId: result.referenceId,
                            }
                            : {
                                code: 'PERSISTENCE_VERIFY_FAILED',
                                message: t.dashboard?.products?.bulkCreate?.persistenceVerifyFailed || 'The saved product could not be verified. Retry to check for the existing draft.',
                                retryable: true,
                                referenceId: prod._id,
                            }
                        if (failure.code === 'CATEGORY_INVALID') invalidateCategories([categoryId])
                        failure.message = localizedFailureMessage(failure)
                        nextFailures[prod._id] = failure
                        toast.error(`${prod.name}: ${failure.message}`)
                        break
                    }
                } catch (error) {
                    void error
                    const failure: DraftSaveFailure = {
                        code: 'SAVE_FAILED',
                        message: t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to create products',
                        retryable: true,
                        referenceId: prod._id,
                    }
                    nextFailures[prod._id] = failure
                    toast.error(`${prod.name}: ${failure.message}`)
                }
            }

            setSaveFailures(current => {
                const next = { ...current }
                for (const id of targetIds) delete next[id]
                for (const id of savedDraftIds) delete next[id]
                return { ...next, ...nextFailures }
            })

            if (savedDraftIds.size > 0) {
                setProducts(current => current.filter(product => !savedDraftIds.has(product._id)))
                const successCount = savedDraftIds.size
                const successMessage = successCount === 1
                    ? t.dashboard?.products?.bulkCreate?.saveSuccessOne || 'Created 1 draft product. Please add images before publishing.'
                    : t.dashboard?.products?.bulkCreate?.saveSuccessMany?.replace('{count}', String(successCount)) || `Created ${successCount} draft products. Please add images before publishing.`
                toast.success(successMessage)

                const remainingDraftCount = products.length - savedDraftIds.size
                if (remainingDraftCount === 0 && Object.keys(nextFailures).length === 0) {
                    onSuccess?.()
                    onClose()
                } else {
                    onPartialSuccess?.()
                }
            }

            const failureCount = Object.keys(nextFailures).length
            if (failureCount > 0) {
                setSaveAnnouncement(t.dashboard?.products?.bulkCreate?.saveFailureSummary?.replace('{count}', String(failureCount)) || `${failureCount} drafts need attention.`)
            }
        } finally {
            setIsSaving(false)
        }
    }

    const updateProduct = (id: string, field: keyof ParsedProduct, value: string | number | boolean | null) => {
        if (isSaving) return
        setProducts(prev => prev.map(product => (product._id === id ? { ...product, [field]: value } : product)))
        if (field === 'categoryId') {
            setSaveFailures(current => {
                const next = { ...current }
                delete next[id]
                return next
            })
        }
    }

    // Stock for a variant product is edited here as one shared value distributed to every
    // variant — this drawer has no per-variant matrix (that's ProductForm's job), so a single
    // input filling all variants uniformly is the only stock input available at this stage.
    // The product's own `inventory` is then derived server-side as the sum of variant stocks
    // (Products.ts beforeChange hook), matching the manual Add/Edit Product form's convention.
    const updateAllVariantsStock = (id: string, stock: number) => {
        if (isSaving) return
        setProducts(prev => prev.map(product => (
            product._id === id
                ? { ...product, variants: product.variants.map(variant => ({ ...variant, stock })) }
                : product
        )))
    }

    const removeProduct = (id: string) => {
        if (isSaving) return
        setProducts(prev => prev.filter(product => product._id !== id))
        setSaveFailures(current => {
            const next = { ...current }
            delete next[id]
            return next
        })
    }

    const handleClose = () => {
        if (hasParsed && products.length > 0 && !isSaving) {
            setShowExitConfirm(true)
            return
        }
        onClose()
    }

    const draftCount = products.length
    const hasRetryableSaveFailures = Object.values(saveFailures).some(failure => failure.retryable)

    if (!mounted) return null

    const modal = createPortal(
        // `dash-shell` sits on this wrapper (not the overlay div below) so the theme-aware
        // `.dash-shell .bg-black/60` override in globals.css (AC-5: light 0.4 / dark 0.7)
        // actually matches as a descendant selector — putting both classes on the same
        // element would never match (a descendant selector can't match an element against
        // itself), silently falling back to Tailwind's flat bg-black/60 (0.6) in both themes.
        <div className="dash-shell">
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 antialiased"
            style={{ fontFamily: "'Inter', sans-serif" }}
        >
            {/* Design-system tokens (not the design mockup's raw hex) — bg/border/text/focus all
                resolve to the same --card/--border/--muted-foreground/--ring vars used by the
                shared <Input> and every other dashboard form (ProductForm, discount-form). */}
            <div role="dialog" aria-modal="true" aria-labelledby="ai-bulk-dialog-title" aria-describedby="ai-bulk-dialog-description" className="flex flex-col max-h-[82vh] w-full max-w-[720px] rounded-[18px] bg-[hsl(var(--card))] shadow-2xl border border-solid border-[hsl(var(--border))] overflow-hidden">
                {/* Header — title + subtitle (left), close button (right) */}
                <div className="flex items-start justify-between gap-3 p-[18px_22px_14px] border-b border-solid border-[hsl(var(--border))]/30">
                    <div className="flex flex-col gap-[3px]">
                        <div className="flex items-center gap-[9px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 2L12.5 8.5L19 11L12.5 13.5L10 20L7.5 13.5L1 11L7.5 8.5L10 2Z" stroke="#2DD4BF" strokeWidth="2" strokeLinejoin="round"/>
                                <path d="M19 2L20.25 5.25L23.5 6.5L20.25 7.75L19 11L17.75 7.75L14.5 6.5L17.75 5.25L19 2Z" fill="#FBBF24"/>
                            </svg>
                            <h2 id="ai-bulk-dialog-title" className="text-[15px] font-bold text-[hsl(var(--foreground))]">
                                {t.dashboard?.products?.bulkCreate?.title || 'Review AI drafts'}
                            </h2>
                        </div>
                        <p id="ai-bulk-dialog-description" className="text-[12px] text-[hsl(var(--muted-foreground))]">
                            {t.dashboard?.products?.bulkCreate?.subtitle || 'Edit anything before adding these to your store. Nothing is published yet.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSaving}
                        className="shrink-0 p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t.dashboard?.products?.bulkCreate?.cancel || 'Close'}
                    >
                        <X className="w-[18px] h-[18px]" />
                    </button>
                </div>

                {/* Body — scrollable draft list */}
                <div className="flex-1 overflow-y-auto px-[24px] pt-[18px] pb-6 flex flex-col">
                    {isParsing ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-[hsl(var(--ring))]" />
                            <p className="text-[hsl(var(--muted-foreground))] text-[14px] font-medium">{t.dashboard?.products?.bulkCreate?.aiWorking || 'AI magic is working...'}</p>
                        </div>
                    ) : (
                        <>
                            {/* Draft cards — one per AI-generated product, matching the design's
                                drawer draft-card pattern (thumbnail + editable fields + remove).
                                Colors/borders/inputs use the same design-system tokens as every
                                other dashboard form (--border, --muted-foreground, shared <Input>),
                                not the design mockup's own one-off hex palette. */}
                            <div className="flex flex-col gap-3 shrink-0">
                                {products.length === 0 ? (
                                    <div className="min-h-[96px] flex flex-col items-center justify-center gap-3 text-center text-[hsl(var(--muted-foreground))] text-[13px] rounded-xl border border-solid border-[hsl(var(--border))]">
                                        <span>{t.dashboard?.products?.bulkCreate?.table?.empty || 'Product list is empty.'}</span>
                                        {canRetryParse ? (
                                            <Button variant="dashSecondary" size="dash" onClick={() => handleParse(initialPrompt)} disabled={isParsing || isSaving}>
                                                {t.dashboard?.products?.bulkCreate?.retry || 'Retry'}
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : (
                                    products.map(p => {
                                        const hasVariants = Boolean(p.variants?.length)
                                        const nameInputId = `bulk-draft-name-${p._id}`
                                        const priceInputId = `bulk-draft-price-${p._id}`
                                        const stockInputId = `bulk-draft-stock-${p._id}`
                                        const categoryLabelId = `ai-category-label-${p._draftOrdinal}`
                                        const categoryTriggerId = `ai-category-trigger-${p._draftOrdinal}`
                                        const categoryErrorId = `ai-category-error-${p._draftOrdinal}`
                                        const categoryHasError = !isAvailableCategoryId(p.categoryId)
                                        const failure = saveFailures[p._id]
                                        const failureId = `ai-save-failure-${p._draftOrdinal}`
                                        const shortReference = failure?.referenceId?.slice(0, 8).toUpperCase()
                                        return (
                                            <div key={p._id} role="group" aria-describedby={failure ? failureId : undefined} className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-solid border-[hsl(var(--border))] p-3 md:grid-cols-[52px_minmax(0,1fr)_28px]">
                                                <div className="col-start-1 row-start-1 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                                    <ImageIcon className="w-5 h-5" />
                                                </div>
                                                <div className="col-span-2 row-start-2 grid min-w-0 grid-cols-2 gap-x-2 gap-y-3 md:col-span-1 md:col-start-2 md:row-start-1 md:grid-cols-[minmax(0,1fr)_100px_72px_110px] md:gap-y-0">
                                                    <div className="col-span-2 flex min-w-0 flex-col gap-1.5 md:col-span-1">
                                                        <label htmlFor={nameInputId} className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                            {t.dashboard?.products?.bulkCreate?.table?.name || 'Product name'}
                                                        </label>
                                                        <ProductNameTextarea
                                                            id={nameInputId}
                                                            disabled={isSaving}
                                                            value={p.name}
                                                            onChange={value => updateProduct(p._id, 'name', value)}
                                                        />
                                                    </div>
                                                    <div className="flex min-w-0 flex-col gap-1.5">
                                                        <label htmlFor={priceInputId} className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                            {t.dashboard?.products?.bulkCreate?.table?.price || 'Price (RM)'}
                                                        </label>
                                                        <Input
                                                            id={priceInputId}
                                                            type="number"
                                                            disabled={isSaving}
                                                            min="0"
                                                            value={p.price}
                                                            onChange={e => updateProduct(p._id, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                                                            className="h-8 min-w-0 px-2.5 py-1.5 text-[12.5px]"
                                                        />
                                                    </div>
                                                    <div className="flex min-w-0 flex-col gap-1.5">
                                                        <label htmlFor={stockInputId} className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                            {t.dashboard?.products?.bulkCreate?.table?.stock || 'Stock'}
                                                        </label>
                                                        <Input
                                                            id={stockInputId}
                                                            type="number"
                                                            disabled={isSaving}
                                                            min="0"
                                                            value={hasVariants ? (p.variants[0]?.stock ?? 0) : (p.stock ?? 0)}
                                                            onChange={e => {
                                                                const next = Math.max(0, parseInt(e.target.value, 10) || 0)
                                                                if (hasVariants) updateAllVariantsStock(p._id, next)
                                                                else updateProduct(p._id, 'stock', next)
                                                            }}
                                                            title={hasVariants ? t.dashboard?.products?.bulkCreate?.table?.stockFromVariants || 'Editing applies this value to every variant' : undefined}
                                                            className="h-8 min-w-0 px-2.5 py-1.5 text-[12.5px]"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex min-w-0 flex-col gap-1.5 md:col-span-1">
                                                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                            {t.dashboard?.products?.bulkCreate?.table?.variants || 'Variants'}
                                                        </span>
                                                        <div className="min-h-8 min-w-0 whitespace-normal break-words pt-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                                                            {hasVariants ? p.variants.map(v => v.name).join(', ') : t.dashboard?.products?.bulkCreate?.table?.defaultVariant || 'Default'}
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-4"
                                                        data-testid={`ai-category-select-${p._draftOrdinal}`}
                                                    >
                                                        <div id={categoryLabelId} className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                                                            {t.dashboard?.products?.bulkCreate?.colCategory || 'Category'}
                                                            <span className="sr-only"> for {p.name?.trim() || 'unnamed product'}, draft {p._draftOrdinal}</span>{' '}
                                                            <span aria-hidden="true" className="text-red-500">*</span>
                                                        </div>
                                                        <CategorySelect
                                                            categories={availableCategories}
                                                            disabled={isSaving}
                                                            triggerId={categoryTriggerId}
                                                            ariaLabelledBy={categoryLabelId}
                                                            errorId={categoryErrorId}
                                                            selectedIds={isAvailableCategoryId(p.categoryId) ? [p.categoryId!] : []}
                                                            onChange={ids => updateProduct(p._id, 'categoryId', ids[0] ?? null)}
                                                            error={categoryHasError ? categoryRequiredMessage : undefined}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => removeProduct(p._id)}
                                                    className="col-start-2 row-start-1 flex h-11 w-11 shrink-0 items-center justify-center justify-self-end rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 md:col-start-3 md:h-7 md:w-7"
                                                    aria-label={t.dashboard?.products?.bulkCreate?.table?.removeDraft || 'Remove draft'}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                {failure ? (
                                                    <div
                                                        id={failureId}
                                                        data-testid={`ai-save-failure-${p._draftOrdinal}`}
                                                        className="col-span-full flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-[hsl(var(--foreground))]"
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                                            <p className="min-w-0 leading-5">{failure.message}</p>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {shortReference && failure.referenceId ? (
                                                                <>
                                                                    <span className="text-[hsl(var(--muted-foreground))]">
                                                                        {t.dashboard?.products?.bulkCreate?.referenceLabel || 'Reference'}:{' '}
                                                                        <code className="font-mono text-[hsl(var(--foreground))]">{shortReference}</code>
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isSaving}
                                                                        onClick={() => void handleCopyReference(failure.referenceId!)}
                                                                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 disabled:opacity-50"
                                                                        aria-label={`${t.dashboard?.products?.bulkCreate?.copyReference || 'Copy reference'} ${shortReference}`}
                                                                    >
                                                                        <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                                                                        {t.dashboard?.products?.bulkCreate?.copyReference || 'Copy reference'}
                                                                    </button>
                                                                </>
                                                            ) : null}
                                                            {failure.retryable && isAvailableCategoryId(p.categoryId) ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={isSaving}
                                                                    onClick={() => void handleSave(p._id)}
                                                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 disabled:opacity-50"
                                                                >
                                                                    <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                                                                    {t.dashboard?.products?.bulkCreate?.retrySave || 'Retry save'}
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer — draft count (left), Discard/Approve All (right) */}
                <div className="flex w-full items-center justify-between gap-3 p-[18px_24px_18px] border-t border-solid border-[hsl(var(--border))]/30">
                    <span className="sr-only" aria-live="polite">{saveAnnouncement}</span>
                    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
                        {draftCount === 1
                            ? t.dashboard?.products?.bulkCreate?.draftCountOne || '1 draft' : t.dashboard?.products?.bulkCreate?.draftCountMany?.replace('{count}', draftCount.toString()) || `${draftCount} drafts`}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="dashSecondary" size="dash" onClick={handleClose} disabled={isSaving}>
                            {t.dashboard?.products?.bulkCreate?.discard || 'Discard'}
                        </Button>
                        <Button variant="dashPrimary" size="dash" onClick={() => void handleSave()} disabled={isSaving || isParsing || draftCount === 0 || hasMissingCategories}>
                            {isSaving ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : null}
                            {isSaving
                                ? t.dashboard?.products?.bulkCreate?.saving || 'Saving…'
                                : hasRetryableSaveFailures
                                    ? t.dashboard?.products?.bulkCreate?.retryFailed || 'Retry failed drafts'
                                    : t.dashboard?.products?.bulkCreate?.approveAll || 'Approve All'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
        </div>,
        document.body
    )

    return (
        <>
            {modal}
            <Dialog.Root open={showExitConfirm} onOpenChange={open => { if (!open) setShowExitConfirm(false) }}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150" />
                    <Dialog.Content
                        className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-none"
                        onPointerDownOutside={() => setShowExitConfirm(false)}
                        onEscapeKeyDown={() => setShowExitConfirm(false)}
                    >
                        <div className="dash-shell w-full max-w-[360px] rounded-[18px] border border-[rgba(59,130,246,0.16)] bg-[var(--dash-surface)] px-6 pb-6 pt-6 shadow-[0_24px_48px_rgba(2,6,23,0.45)]">
                            <div className="text-center">
                                <Dialog.Title className="text-xl font-semibold text-dash-text">
                                    {t.dashboard?.products?.bulkCreate?.exitButton}?</Dialog.Title>
                                <Dialog.Description className="mt-2 text-sm leading-6 text-dash-text-muted">
                                    {t.dashboard?.products?.bulkCreate?.unsavedWarning}
                                </Dialog.Description>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        className="flex h-11 items-center justify-center rounded-[10px] border border-dash-border bg-dash-secondary-bg text-sm font-medium text-dash-text transition-colors hover:bg-dash-surface-hover"
                                    >
                                        {t.dashboard?.products?.bulkCreate?.stayButton}
                                    </button>
                                </Dialog.Close>
                                <button
                                    type="button"
                                    onClick={() => { setShowExitConfirm(false)
                                        onClose()
                                    }}
                                    className="flex h-11 items-center justify-center rounded-[10px] border border-[rgba(251,44,54,0.4)] bg-[#FF1F3D] text-sm font-medium text-white transition-colors hover:bg-[#ff3550]"
                                >
                                    {t.dashboard?.products?.bulkCreate?.exitButton}
                                </button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    )
}

export const PRODUCT_NAME_MAX_LENGTH = 120
// More than 34x the persisted limit: ample headroom for separators/invalid code points while
// bounding work and intermediate memory for pathological paste or AI-generated values.
const PRODUCT_NAME_INPUT_SCAN_LIMIT = 4096

let productNameGraphemeSegmenter: Intl.Segmenter | undefined

function getProductNameGraphemeSegmenter(): Intl.Segmenter | undefined {
    const Segmenter = Intl.Segmenter
    if (typeof Segmenter !== 'function') return undefined

    productNameGraphemeSegmenter ??= new Segmenter(undefined, { granularity: 'grapheme' })
    return productNameGraphemeSegmenter
}

function sanitizeDraftProductNameInput(value: string) {
    const boundedValue = value.slice(0, PRODUCT_NAME_INPUT_SCAN_LIMIT)
    let sanitizedValue = ''
    let previousCharacterWasSeparator = false

    for (const character of boundedValue) {
        if (/[\r\n\u2028\u2029]/.test(character)) {
            if (!previousCharacterWasSeparator) sanitizedValue += ' '
            previousCharacterWasSeparator = true
            continue
        }

        previousCharacterWasSeparator = false
        const codePoint = character.codePointAt(0)
        if (codePoint !== undefined && codePoint >= 0xD800 && codePoint <= 0xDFFF) continue
        sanitizedValue += character
    }

    return {
        sanitizedValue,
        inputWasTruncated: value.length > PRODUCT_NAME_INPUT_SCAN_LIMIT,
    }
}

function* completeDraftProductNameSegments(segments: Iterable<{ segment: string }>, omitTrailingSegment: boolean) {
    let pendingSegment: string | undefined

    for (const { segment } of segments) {
        if (pendingSegment !== undefined) yield pendingSegment
        pendingSegment = segment
    }

    // A truncated raw prefix may end inside an arbitrarily long grapheme. Holding back its final
    // segment prevents returning a cluster that was only partial in the original input.
    if (!omitTrailingSegment && pendingSegment !== undefined) yield pendingSegment
}

export function normalizeDraftProductName(value: string) {
    const segmenter = getProductNameGraphemeSegmenter()
    if (!segmenter) {
        // Do not guess Unicode boundaries in browsers without Intl.Segmenter. Preserve over-limit
        // input for the authoritative server-side max(120) validation instead of corrupting it.
        if (value.length > PRODUCT_NAME_INPUT_SCAN_LIMIT) return value
        return sanitizeDraftProductNameInput(value).sanitizedValue
    }

    const { sanitizedValue, inputWasTruncated } = sanitizeDraftProductNameInput(value)
    let normalizedValue = ''

    for (const segment of completeDraftProductNameSegments(segmenter.segment(sanitizedValue), inputWasTruncated)) {
        if (normalizedValue.length + segment.length > PRODUCT_NAME_MAX_LENGTH) break
        normalizedValue += segment
    }

    return normalizedValue
}

interface ProductNameTextareaProps {
    id: string
    value: string
    disabled: boolean
    onChange: (value: string) => void
}

function ProductNameTextarea({ id, value, disabled, onChange }: ProductNameTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const isComposingRef = useRef(false)
    useAutoResizeTextarea(textareaRef, value, Number.POSITIVE_INFINITY)

    return (
        <Textarea
            ref={textareaRef}
            id={id}
            rows={1}
            disabled={disabled}
            value={value}
            onChange={(event) => onChange(normalizeDraftProductName(event.target.value))}
            onCompositionStart={() => {
                isComposingRef.current = true
            }}
            onCompositionEnd={() => {
                isComposingRef.current = false
            }}
            onBlur={() => {
                isComposingRef.current = false
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' && !(isComposingRef.current || event.nativeEvent.isComposing)) {
                    event.preventDefault()
                }
            }}
            className="min-h-8 min-w-0 resize-none overflow-x-hidden px-2.5 py-1.5 text-[12.5px] leading-[18px]"
        />
    )
}
