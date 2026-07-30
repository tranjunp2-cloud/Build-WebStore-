'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2, Sparkles, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { saveAiProductAction } from '@/app/(dashboard)/products/actions'
import { useI18n } from '@/i18n'
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll'
import { Input } from '@/components/ui/input'
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
    _id: string // stable parse-local identity for state updates and grid keys
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

// True when saveAiProductAction rejected specifically because a generated SKU already exists
// for this tenant (base sku and/or one or more variant skus) — the one case worth an
// automatic retry with freshly regenerated SKUs, since the AI/fallback generator can't see
// the merchant's existing catalog and occasionally collides with it.
function isSkuConflictError(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    try {
        const parsed = JSON.parse(err.message)
        if (parsed?.code !== 'FIELD_ERRORS') return false
        return Object.keys(parsed.fieldErrors || {}).some(f => f === 'baseSku' || /^variants\.\d+\.skuCode$/.test(f))
    } catch {
        return false
    }
}

function isCategoryInvalidResult(result: unknown): result is { ok: false; code: 'CATEGORY_INVALID' } {
    return typeof result === 'object' &&
        result !== null &&
        'ok' in result && result.ok === false &&
        'code' in result && result.code === 'CATEGORY_INVALID'
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
    const baseSlug = prod.slug || slugify(prod.name)
    const finalSlug = baseSlug + '-' + Math.random().toString(36).substring(2, 7)

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
                const initProducts = data.products.map((rawProduct: ParsedProduct & { category?: unknown }, draftIndex: number) => {
                    // Discard the legacy name-based contract before spreading normalized data.
                    const { category: _legacyCategory, ...p } = rawProduct
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
                        variants: cleanedVariants,
                        _id: `draft-${draftIndex + 1}`,
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

    const handleSave = async () => {
        if (products.length === 0) {
            toast.error(t.dashboard?.products?.bulkCreate?.saveEmptyError || 'Please select at least 1 product')
            return
        }
        if (hasMissingCategories) {
            toast.error(categoryRequiredMessage)
            return
        }

        setIsSaving(true)
        let successCount = 0

        try {
            // Revalidate only selected category IDs before any save-side effect. If this fails,
            // fail the batch closed: no carton placeholder and no partial products.
            const selectedCategoryIds = products.map(product => product.categoryId!)
            let revalidatedCategories: { id: string | number }[]
            try {
                revalidatedCategories = await getCategoriesByIdsAction(selectedCategoryIds)
            } catch (err) {
                console.warn('Could not fetch categories', err)
                toast.error(t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to save products')
                return
            }
            const categoryById = new Map(revalidatedCategories.map(category => [String(category.id), category.id]))

            const unavailableCategoryIds = new Set(selectedCategoryIds.filter(categoryId => !categoryById.has(String(categoryId))).map(String))

            if (unavailableCategoryIds.size > 0) {
                invalidateCategories(Array.from(unavailableCategoryIds))
                toast.error(categoryRequiredMessage)
                return
            }

            // Get Crate Carton placeholder ID
            let cartonMediaId = null
            try {
                cartonMediaId = await getOrCreateCrateCartonIdAction() // Update list to prevent duplicate creation for next items
            } catch (err) {
                console.warn('Could not get default crate carton placeholder', err)
            }

            const savedDraftIds = new Set<string>()
            let categoryBecameInvalid = false
            let hasSaveFailure = false
            for (const prod of products) {
                // Persist the canonical tenant-owned category returned by pre-save revalidation.
                const categoryId = categoryById.get(String(prod.categoryId))!

                const defaultVariantName = t.dashboard?.products?.bulkCreate?.table?.defaultVariant || 'Default'
                const tierLabels = {
                    first: t.dashboard?.products?.form?.sections?.color || DEFAULT_VARIANT_TIER_LABELS.first,
                    second: t.dashboard?.products?.form?.sections?.size || DEFAULT_VARIANT_TIER_LABELS.second,
                }
                let payload = buildSavePayload(prod, cartonMediaId, categoryId, defaultVariantName, tierLabels)

                // Retry with freshly regenerated SKUs on a uniqueness conflict — the AI/fallback
                // generator can't see the merchant's existing catalog, so an occasional collision
                // is expected. A handful of attempts resolves it without bothering the merchant.
                const MAX_SKU_ATTEMPTS = 3
                let skuAttempt = 1
                while (skuAttempt <= MAX_SKU_ATTEMPTS) {
                    try {
                        const res = await saveAiProductAction(payload)
                        if (isCategoryInvalidResult(res)) {
                            invalidateCategories([categoryId])
                            categoryBecameInvalid = true
                            toast.error(categoryRequiredMessage)
                            break
                        }

                        if (res?.id) {
                            successCount++
                            savedDraftIds.add(prod._id)
                        } else {
                            const fallback = t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to create products'
                            hasSaveFailure = true
                            toast.error(`${prod.name}: ${fallback}`)
                            console.error('[bulk-create] saveAiProductAction returned no id', { name: prod.name, res })
                        }
                        break
                    } catch (err) {
                        if (isSkuConflictError(err) && skuAttempt < MAX_SKU_ATTEMPTS) {
                            skuAttempt++
                            const retrySkus = new Set<string>()
                            payload = {
                                ...payload,
                                sku: generateUniqueSku(payload.name, retrySkus),
                                variants: payload.variants?.map(v => ({
                                    ...v,
                                    sku: generateUniqueSku(`${payload.name}-${v.name}`, retrySkus),
                                })),
                            }
                            continue
                        }
                        hasSaveFailure = true
                        let msg: string
                        try {
                            msg = JSON.parse((err as Error).message)?.message || (err as Error).message || ''
                        } catch {
                            msg = err instanceof Error ? err.message : ''
                        }
                        toast.error(`${prod.name}: ${msg || t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to create products'}`)
                        console.warn('Failed to save product', prod.name, err)
                        break
                    }
                }
                if (categoryBecameInvalid) break
            }

            if (categoryBecameInvalid || hasSaveFailure) {
                // Keep only unsaved drafts in the drawer. Otherwise retrying after any terminal
                // per-product failure would duplicate products already committed in this
                // sequential batch, while closing would discard the failed drafts.
                if (savedDraftIds.size > 0) {
                    setProducts(current => current.filter(product => !savedDraftIds.has(product._id)))
                    if (successCount > 0) {
                        const tmpl = successCount === 1
                            ? t.dashboard?.products?.bulkCreate?.saveSuccessOne || 'Created 1 draft product. Please add images before publishing.'
                            : t.dashboard?.products?.bulkCreate?.saveSuccessMany?.replace('{count}', successCount.toString()) || `Created ${successCount} draft products. Please add images before publishing.`
                        toast.success(tmpl)
                    }
                    onPartialSuccess?.()
                }
                return
            }

            if (successCount > 0) {
                const tmpl = successCount === 1
                    ? t.dashboard?.products?.bulkCreate?.saveSuccessOne || 'Created 1 draft product. Please add images before publishing.' : t.dashboard?.products?.bulkCreate?.saveSuccessMany?.replace('{count}', successCount.toString()) || `Created ${successCount} draft products. Please add images before publishing.`
                toast.success(tmpl)
                if (onSuccess) onSuccess()
                onClose()
            } else {
                toast.error(t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to save products')
            }

        } catch (error) {
            console.error('Bulk save error:', error)
            toast.error(t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to save products')
        } finally {
            setIsSaving(false)
        }
    }

    const updateProduct = (id: string, field: keyof ParsedProduct, value: string | number | boolean | null) => {
        if (isSaving) return
        setProducts(prev => prev.map(p => (p._id === id ? { ...p, [field]: value } : p)))
    }

    // Stock for a variant product is edited here as one shared value distributed to every
    // variant — this drawer has no per-variant matrix (that's ProductForm's job), so a single
    // input filling all variants uniformly is the only stock input available at this stage.
    // The product's own `inventory` is then derived server-side as the sum of variant stocks
    // (Products.ts beforeChange hook), matching the manual Add/Edit Product form's convention.
    const updateAllVariantsStock = (id: string, stock: number) => {
        if (isSaving) return
        setProducts(prev => prev.map(p => (p._id === id ? { ...p, variants: p.variants.map(v => ({ ...v, stock })) } : p
        )))
    }

    const removeProduct = (id: string) => {
        if (isSaving) return
        setProducts(prev => prev.filter(p => p._id !== id))
    }

    const handleClose = () => {
        if (hasParsed && products.length > 0 && !isSaving) {
            setShowExitConfirm(true)
            return
        }
        onClose()
    }

    const draftCount = products.length

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
            <div className="flex flex-col max-h-[82vh] w-full max-w-[720px] rounded-[18px] bg-[hsl(var(--card))] shadow-2xl border border-solid border-[hsl(var(--border))] overflow-hidden">
                {/* Header — title + subtitle (left), close button (right) */}
                <div className="flex items-start justify-between gap-3 p-[18px_22px_14px] border-b border-solid border-[hsl(var(--border))]/30">
                    <div className="flex flex-col gap-[3px]">
                        <div className="flex items-center gap-[9px]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 2L12.5 8.5L19 11L12.5 13.5L10 20L7.5 13.5L1 11L7.5 8.5L10 2Z" stroke="#2DD4BF" strokeWidth="2" strokeLinejoin="round"/>
                                <path d="M19 2L20.25 5.25L23.5 6.5L20.25 7.75L19 11L17.75 7.75L14.5 6.5L17.75 5.25L19 2Z" fill="#FBBF24"/>
                            </svg>
                            <h2 className="text-[15px] font-bold text-[hsl(var(--foreground))]">
                                {t.dashboard?.products?.bulkCreate?.title || 'Review AI drafts'}
                            </h2>
                        </div>
                        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
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
                                        return (
                                        <div key={p._id} className="flex gap-3 items-start rounded-xl border border-solid border-[hsl(var(--border))] p-3">
                                            <div className="shrink-0 w-[52px] h-[52px] rounded-[10px] bg-[hsl(var(--muted))] flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                                                <ImageIcon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                                <div className="flex gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                                                    <span className="flex-1">{t.dashboard?.products?.bulkCreate?.table?.name || 'Product name'}</span>
                                                    <span className="w-[72px] md:w-[100px] shrink-0">{t.dashboard?.products?.bulkCreate?.table?.price || 'Price (RM)'}</span>
                                                    <span className="w-[64px] md:w-[72px] shrink-0">{t.dashboard?.products?.bulkCreate?.table?.stock || 'Stock'}</span>
                                                    <span className="hidden md:block w-[110px] shrink-0">{t.dashboard?.products?.bulkCreate?.table?.variants || 'Variants'}</span>
                                                </div>
                                                <div className="flex gap-2 items-start">
                                                    {/* Single-line input, matching the design reference (ai-bulk-create.html
                                                        uses <input class="f-name">, not a textarea) — guarantees this field
                                                        is always the same fixed height as Price/Stock/Variants next to it;
                                                        a long name scrolls horizontally within the box rather than
                                                        wrapping/growing the row. */}
                                                    <Input
                                                        type="text"
                                                        disabled={isSaving}
                                                        value={p.name}
                                                        onChange={e => updateProduct(p._id, 'name', e.target.value)}
                                                        className="flex-1 min-w-0 h-8 px-2.5 py-1.5 text-[12.5px]"
                                                    />
                                                    <Input
                                                        type="number"
                                                        disabled={isSaving}
                                                        min="0"
                                                        value={p.price}
                                                        onChange={e => updateProduct(p._id, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                                                        className="w-[72px] md:w-[100px] shrink-0 h-8 px-2.5 py-1.5 text-[12.5px]"
                                                    />
                                                    <Input
                                                        type="number"
                                                        disabled={isSaving}
                                                        min="0"
                                                        // For a variant product this drawer has no per-variant matrix (that's
                                                        // ProductForm's job) — so Stock is one shared value distributed to
                                                        // every variant uniformly on edit. Displays the first variant's own
                                                        // stock (not a sum) since that's what re-editing this field would
                                                        // apply everywhere. The AI parse prompt instructs stock:0 uniformly
                                                        // across variants (route.ts), but that's not an enforced constraint —
                                                        // the tooltip is explicit about the "applies to every variant"
                                                        // semantics so a non-uniform AI response is never misread as a total.
                                                        value={hasVariants ? (p.variants[0]?.stock ?? 0) : (p.stock ?? 0)}
                                                        onChange={e => {
                                                            const next = Math.max(0, parseInt(e.target.value, 10) || 0)
                                                            if (hasVariants) updateAllVariantsStock(p._id, next)
                                                            else updateProduct(p._id, 'stock', next)
                                                        }}
                                                        title={hasVariants ? t.dashboard?.products?.bulkCreate?.table?.stockFromVariants || 'Editing applies this value to every variant' : undefined}
                                                        className="w-[64px] md:w-[72px] shrink-0 h-8 px-2.5 py-1.5 text-[12.5px]"
                                                    />
                                                    <div className="hidden md:block min-w-[110px] w-[110px] shrink-0 self-start pt-1.5 text-[12px] text-[hsl(var(--muted-foreground))] whitespace-normal break-words">
                                                        {hasVariants ? p.variants.map(v => v.name).join(', ') : t.dashboard?.products?.bulkCreate?.table?.defaultVariant || 'Default'}
                                                    </div>
                                                </div>
                                                <div
                                                    className="mt-1 flex flex-col gap-1"
                                                    data-testid={`ai-category-select-${p._draftOrdinal}`}
                                                >
                                                    <div className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                                                        {t.dashboard?.products?.bulkCreate?.colCategory || 'Category'}
                                                        <span className="sr-only"> for {p.name?.trim() || 'unnamed product'}, draft {p._draftOrdinal}</span>{' '}
                                                        <span aria-hidden="true" className="text-red-500">*</span>
                                                    </div>
                                                    <CategorySelect
                                                        categories={availableCategories}
                                                        disabled={isSaving}
                                                        selectedIds={isAvailableCategoryId(p.categoryId) ? [p.categoryId!] : []}
                                                        onChange={ids => updateProduct(p._id, 'categoryId', ids[0] ?? null)}
                                                        error={!isAvailableCategoryId(p.categoryId) ? categoryRequiredMessage : undefined}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => removeProduct(p._id)}
                                                className="shrink-0 p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                                aria-label={t.dashboard?.products?.bulkCreate?.table?.removeDraft || 'Remove draft'}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
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
                    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
                        {draftCount === 1
                            ? t.dashboard?.products?.bulkCreate?.draftCountOne || '1 draft' : t.dashboard?.products?.bulkCreate?.draftCountMany?.replace('{count}', draftCount.toString()) || `${draftCount} drafts`}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="dashSecondary" size="dash" onClick={handleClose} disabled={isSaving}>
                            {t.dashboard?.products?.bulkCreate?.discard || 'Discard'}
                        </Button>
                        <Button variant="dashPrimary" size="dash" onClick={handleSave} disabled={isSaving || isParsing || draftCount === 0 || hasMissingCategories}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {t.dashboard?.products?.bulkCreate?.approveAll || 'Approve All'}
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
