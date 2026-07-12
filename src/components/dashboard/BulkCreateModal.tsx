'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2, Sparkles, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { saveProductAction } from '@/app/(dashboard)/products/actions'
import { useI18n } from '@/i18n'
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll'
import { Input } from '@/components/ui/input'

import { getOrCreateCrateCartonIdAction } from '@/app/(dashboard)/actions/media'
import { getCategoriesAction, saveCategoryAction } from '@/app/(dashboard)/products/categories/actions'

interface VariantPayload {
    name: string
    price: number
    compareAtPrice?: number
    sku: string
    stock: number
}

interface ParsedProduct {
    _id?: string // for grid keys
    // No longer read — the review drawer removes an unwanted draft outright (removeProduct)
    // instead of a select/deselect checkbox. Left optional rather than deleted so existing
    // callers/fixtures that still set it don't need updating.
    selected?: boolean
    name: string
    price: number
    compareAtPrice?: number
    category: string
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
    variantConfigs?: { name: string, options: { value: string }[] }[]
}

interface BulkCreateModalProps {
    onClose: () => void
    onSuccess?: () => void
    initialPrompt?: string
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

const textToLexical = (text: string) => {
    if (!text) return undefined;
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
                children: p ? [{ type: 'text', text: p, mode: 'normal', style: '', detail: 0, format: 0, version: 1 }] : []
            }))
        }
    };
}

// True when saveProductAction rejected specifically because a generated SKU already exists
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

export function sanitizeXSS(text: string) {
    if (!text) return text;
    let safe = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    return safe.replace(/<[^>]*>?/gm, '').trim();
}

// Untrusted AI output — a malformed/omitted numeric field parses to NaN via `Number(v)`, and
// `NaN ?? fallback` does NOT catch it (NaN is neither null nor undefined, unlike what `??`
// checks for), so a bare `Number(v ?? fallback)` still lets a raw NaN through into a
// controlled <input type="number">. Coerce with an explicit finiteness check instead.
function coerceFiniteNumber(value: unknown, fallback = 0): number {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

export function buildSavePayload(prod: ParsedProduct, cartonMediaId: string | number | null, categoryId: string | number | null, defaultVariantName: string = 'Default') {
    const hasVariants = Boolean(prod.variants?.length)
    const baseSlug = prod.slug || slugify(prod.name)
    const finalSlug = baseSlug + '-' + Math.random().toString(36).substring(2, 7)

    // Force generation of variantConfigs from variant names to guarantee 100% option mapping accuracy
    // and correctly capture merged multi-tier options. We ignore AI's variantConfigs because they often
    // mismatch when tiers are clamped/merged.
    let variantConfigs: { name: string; options: { value: string }[] }[] | undefined = [];
    if (hasVariants) {
        const splitVariants = prod.variants!.map(v => (v.name || defaultVariantName).split(' - '));
        const numTiers = Math.max(...splitVariants.map(v => v.length));
        const validNumTiers = Math.min(numTiers, 2); // DB schema limits to 2 tiers
        
        if (validNumTiers > 0) {
            variantConfigs = Array.from({ length: validNumTiers }).map((_, i) => ({
                name: i === 0 ? 'Color' : 'Size',
                options: Array.from(
                    new Set(splitVariants.map(v => {
                        // Drop excess splits if AI provided too many
                        return (v[i] || '').trim();
                    }).filter(val => val !== ''))
                ).map(val => ({ value: val }))
            }));
        }
    }

    // Defensive clamping on variant names to prevent > 1 hyphen if user didn't correct it.
    // Case-insensitive name-uniqueness (guarding products_variants_name_parent_uniq — see
    // handleParse's uniqueMap above) is enforced earlier, at parse time, rather than here:
    // renaming a variant this late (post-parse, pre-save) would desync it from
    // buildVariantMatrix's exact-string tier-combo matching (variant-utils.ts) the next time
    // the merchant edits the tier matrix in ProductForm, silently resetting its price/sku/stock.
    let safeVariants = prod.variants;
    if (hasVariants && safeVariants) {
        safeVariants = safeVariants.map(v => {
            const rawName = v.name || defaultVariantName;
            const parts = rawName.split(' - ');
            if (parts.length > 2) {
                 // Truncate to maximum 2 tiers
                 return { ...v, name: `${parts[0].trim()} - ${parts[1].trim()}` }
            }
            return { ...v, name: rawName.trim() };
        });
    }

    let safeName = sanitizeXSS(prod.name).trim() || 'Product';
    if (safeName.length < 3) {
        safeName = safeName + ' (Bulk)';
    }

    return {
        name: safeName,
        slug: finalSlug,
        sku: sanitizeXSS(prod.sku || '').trim() || generateFallbackSku(safeName),
        price: Number(prod.price) || 0,
        compareAtPrice: (prod.compareAtPrice && Number(prod.compareAtPrice) > Number(prod.price)) ? Number(prod.compareAtPrice) : null,
        description: prod.description ? textToLexical(sanitizeXSS(prod.description)) : undefined,
        status: 'draft',
        aiReviewPending: true,
        hasVariants,
        variantConfigs,
        category: categoryId ? [categoryId] : undefined,
        images: cartonMediaId ? [{ image: cartonMediaId, alt: sanitizeXSS(prod.name) }] : [],
        seo: {
            title: sanitizeXSS(prod.seoTitle || ''),
            description: sanitizeXSS(prod.seoDescription || '')
        },
        dimensions: {
            length: Number(prod.length) || 0,
            width: Number(prod.width) || 0,
            height: Number(prod.height) || 0
        },
        variants: hasVariants ? safeVariants!.map(v => {
            const variantPrice = Number(v.price || prod.price) || 0
            // Fall back to the product-level compareAtPrice when the AI omits a per-variant
            // one (the bulk-parse prompt only asks the AI for compareAtPrice at product level
            // in some responses) — otherwise variants silently lose the "was" price entirely.
            const compareAtPriceCandidate = v.compareAtPrice ?? prod.compareAtPrice
            return {
                name: sanitizeXSS(v.name || defaultVariantName),
                price: variantPrice,
                compareAtPrice: (compareAtPriceCandidate && Number(compareAtPriceCandidate) > variantPrice) ? Number(compareAtPriceCandidate) : null,
                stock: coerceFiniteNumber(v.stock),
                sku: sanitizeXSS(v.sku || '').trim() || generateFallbackSku(`${safeName}-${v.name || defaultVariantName}`)
            }
        }) : undefined,
        // Server recomputes this as the sum of variant stocks for hasVariants products anyway
        // (Products.ts beforeChange hook overrides whatever is sent) — computed here too so the
        // payload is internally consistent with what the review drawer displayed (Stock there
        // edits every variant uniformly; base "inventory" = sum, matching VariantOptionsSection's
        // `setValue('baseInventory', total)` convention in the manual Add/Edit Product form).
        inventory: hasVariants ? safeVariants!.reduce((sum, v) => sum + coerceFiniteNumber(v.stock), 0) : coerceFiniteNumber(prod.stock),
        weight: prod.weight || 1, // Fallback for F14 dimension requirements
    }
}

export function BulkCreateModal({ onClose, onSuccess, initialPrompt = '' }: BulkCreateModalProps) {
    const { t, locale } = useI18n()
    const [isParsing, setIsParsing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [products, setProducts] = useState<ParsedProduct[]>([])
    const [hasParsed, setHasParsed] = useState(false)
    const [mounted, setMounted] = useState(false)
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
        try {
            const res = await fetch('/api/ai/products-bulk-parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ promptText, locale })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'parseError')

            if (data.products && Array.isArray(data.products)) {
                const initProducts = data.products.map((p: ParsedProduct) => {
                    let cleanedVariants = p.variants;
                    if (cleanedVariants && cleanedVariants.length > 0) {
                        // Case-insensitive dedup — DB has a case-insensitive unique index
                        // (products_variants_name_parent_uniq on lower(name) per parent) that the
                        // app-level SKU pre-check never validates against. Keying by lowercase here
                        // (not just exact string) guarantees no case-differing duplicate ever reaches
                        // buildSavePayload/the DB in the first place, so there's no need to rename a
                        // saved row later — which would desync it from buildVariantMatrix's exact-
                        // string tier-combo matching (variant-utils.ts) and reset its custom
                        // price/sku/stock the next time the merchant edits the tier matrix.
                        const uniqueMap = new Map<string, NonNullable<ParsedProduct['variants']>[number]>();
                        cleanedVariants.forEach(v => {
                            const rawName = v.name || 'Default';
                            const parts = rawName.split(' - ');
                            const truncatedName = parts.slice(0, 2).map(s => s.trim()).join(' - ');
                            const key = truncatedName.toLowerCase();
                            if (!uniqueMap.has(key)) {
                                // Same untrusted-AI-input coercion as the top-level price/stock below —
                                // fixed here (parse time) so the drawer's per-variant Stock display
                                // (variants[0].stock) and buildSavePayload both see a clean value.
                                uniqueMap.set(key, { ...v, name: truncatedName, stock: coerceFiniteNumber(v.stock) });
                            }
                        });
                        cleanedVariants = Array.from(uniqueMap.values());
                    }
                    return {
                        ...p,
                        variants: cleanedVariants,
                        _id: Math.random().toString(36).substring(2, 11),
                        selected: true,
                        category: p.category || '',
                        // Untrusted AI output — the prompt asks for "0 if not specified", but the
                        // model can still omit/malform this on unparseable input (e.g. gibberish
                        // with no price/stock mentioned). Coerce here (not just later in
                        // buildSavePayload) so the review drawer's <input type="number"> never
                        // receives a raw non-numeric value as `value`.
                        price: coerceFiniteNumber(p.price),
                        stock: coerceFiniteNumber(p.stock),
                    };
                });
                setProducts(initProducts)
            } else {
                toast.error(t.dashboard?.products?.bulkCreate?.parseInvalidData || 'Invalid products format received from AI')
            }
        } catch (error) {
            const errBase = error as Error
            let errMsg = t.dashboard?.products?.bulkCreate?.parseError || 'Failed to parse products summary'
            if (errBase.message === 'aiQuotaExceeded') errMsg = t.dashboard?.products?.bulkCreate?.aiQuotaExceeded || 'AI system overloaded'
            else if (errBase.message === 'aiTimeout') errMsg = t.dashboard?.products?.bulkCreate?.aiTimeout || 'AI timeout'
            
            toast.error(errMsg)
        } finally {
            setIsParsing(false)
            setHasParsed(true)
        }
    }

    const handleSave = async () => {
        if (products.length === 0) {
            toast.error(t.dashboard?.products?.bulkCreate?.saveEmptyError || 'Please select at least 1 product')
            return
        }

        setIsSaving(true)
        let successCount = 0

        try {
            // Get Crate Carton placeholder ID
            let cartonMediaId = null
            try {
                cartonMediaId = await getOrCreateCrateCartonIdAction()
            } catch (err) {
                console.warn('Could not get default crate carton placeholder', err)
            }

            // Fetch existing categories to map product categories intelligently
            let allCategories: { id: string | number; name: string }[] = []
            try {
                allCategories = await getCategoriesAction()
            } catch (err) {
                console.warn('Could not fetch categories', err)
            }

            for (const prod of products) {
                // Determine Category Mapping
                let categoryId: string | number | null = null
                if (prod.category) {
                    const matchedCategory = allCategories.find((c) => c.name.toLowerCase().trim() === prod.category.toLowerCase().trim())
                    
                    if (matchedCategory) {
                        categoryId = matchedCategory.id
                    } else {
                        // Create the category since it doesn't exist
                        try {
                            const newCat = await saveCategoryAction({ name: prod.category })
                            if (newCat && newCat.id) {
                                categoryId = newCat.id
                                allCategories.push(newCat) // Update list to prevent duplicate creation for next items
                            }
                        } catch (err) {
                            console.warn('Failed to auto-create missing category', prod.category, err)
                        }
                    }
                }

                const defaultVariantName = t.dashboard?.products?.bulkCreate?.table?.defaultVariant || 'Default'
                let payload = buildSavePayload(prod, cartonMediaId, categoryId, defaultVariantName)

                // Retry with freshly regenerated SKUs on a uniqueness conflict — the AI/fallback
                // generator can't see the merchant's existing catalog, so an occasional collision
                // is expected. A handful of attempts resolves it without bothering the merchant.
                const MAX_SKU_ATTEMPTS = 3
                for (let attempt = 1; attempt <= MAX_SKU_ATTEMPTS; attempt++) {
                    try {
                        const res = await saveProductAction(payload)
                        if (res?.id) {
                            successCount++
                        } else {
                            const fallback = t.dashboard?.products?.bulkCreate?.saveFailed || 'Failed to create products'
                            toast.error(`${prod.name}: ${fallback}`)
                            console.error('[bulk-create] saveProductAction returned no id', { name: prod.name, res })
                        }
                        break
                    } catch (err) {
                        if (isSkuConflictError(err) && attempt < MAX_SKU_ATTEMPTS) {
                            payload = {
                                ...payload,
                                sku: generateFallbackSku(payload.name),
                                variants: payload.variants?.map(v => ({ ...v, sku: generateFallbackSku(`${payload.name}-${v.name}`) })),
                            }
                            continue
                        }
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
            }

            if (successCount > 0) {
                const tmpl = successCount === 1
                    ? (t.dashboard?.products?.bulkCreate?.saveSuccessOne || 'Created 1 draft product. Please add images before publishing.')
                    : (t.dashboard?.products?.bulkCreate?.saveSuccessMany?.replace('{count}', successCount.toString()) || `Created ${successCount} draft products. Please add images before publishing.`)
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

    const updateProduct = (id: string, field: keyof ParsedProduct, value: string | number | boolean) => {
        setProducts(prev => prev.map(p => p._id === id ? { ...p, [field]: value } : p))
    }

    // Stock for a variant product is edited here as one shared value distributed to every
    // variant — this drawer has no per-variant matrix (that's ProductForm's job), so a single
    // input filling all variants uniformly is the only stock input available at this stage.
    // The product's own `inventory` is then derived server-side as the sum of variant stocks
    // (Products.ts beforeChange hook), matching the manual Add/Edit Product form's convention.
    const updateAllVariantsStock = (id: string, stock: number) => {
        setProducts(prev => prev.map(p =>
            p._id === id ? { ...p, variants: p.variants.map(v => ({ ...v, stock })) } : p
        ))
    }

    const removeProduct = (id: string) => {
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
                                    <div className="h-[62px] flex items-center justify-center text-center text-[hsl(var(--muted-foreground))] text-[13px] rounded-xl border border-solid border-[hsl(var(--border))]">
                                        {t.dashboard?.products?.bulkCreate?.table?.empty || 'Product list is empty.'}
                                    </div>
                                ) : products.map((p) => {
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
                                                        value={p.name}
                                                        onChange={(e) => updateProduct(p._id!, 'name', e.target.value)}
                                                        className="flex-1 min-w-0 h-8 px-2.5 py-1.5 text-[12.5px]"
                                                    />
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={p.price}
                                                        onChange={(e) => updateProduct(p._id!, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                                                        className="w-[72px] md:w-[100px] shrink-0 h-8 px-2.5 py-1.5 text-[12.5px]"
                                                    />
                                                    <Input
                                                        type="number"
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
                                                        onChange={(e) => {
                                                            const next = Math.max(0, parseInt(e.target.value, 10) || 0)
                                                            if (hasVariants) updateAllVariantsStock(p._id!, next)
                                                            else updateProduct(p._id!, 'stock', next)
                                                        }}
                                                        title={hasVariants ? (t.dashboard?.products?.bulkCreate?.table?.stockFromVariants || 'Editing applies this value to every variant') : undefined}
                                                        className="w-[64px] md:w-[72px] shrink-0 h-8 px-2.5 py-1.5 text-[12.5px]"
                                                    />
                                                    <div className="hidden md:block w-[110px] shrink-0 self-center text-[12px] text-[hsl(var(--muted-foreground))] truncate">
                                                        {hasVariants ? p.variants.map(v => v.name).join(', ') : (t.dashboard?.products?.bulkCreate?.table?.defaultVariant || 'Default')}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeProduct(p._id!)}
                                                className="shrink-0 p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                aria-label={t.dashboard?.products?.bulkCreate?.table?.removeDraft || 'Remove draft'}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer — draft count (left), Discard/Approve All (right) */}
                <div className="flex w-full items-center justify-between gap-3 p-[18px_24px_18px] border-t border-solid border-[hsl(var(--border))]/30">
                    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
                        {draftCount === 1
                            ? (t.dashboard?.products?.bulkCreate?.draftCountOne || '1 draft')
                            : (t.dashboard?.products?.bulkCreate?.draftCountMany?.replace('{count}', draftCount.toString()) || `${draftCount} drafts`)}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClose}
                            disabled={isSaving}
                            className="h-[42px] px-5 rounded-2xl bg-transparent border border-solid border-[hsl(var(--border))] text-[14px] font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t.dashboard?.products?.bulkCreate?.discard || 'Discard'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isParsing || draftCount === 0}
                            className="h-[42px] px-5 rounded-2xl bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] text-[14px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {t.dashboard?.products?.bulkCreate?.approveAll || 'Approve All'}
                        </button>
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
            <Dialog.Root open={showExitConfirm} onOpenChange={(open) => { if (!open) setShowExitConfirm(false) }}>
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
                                    {t.dashboard?.products?.bulkCreate?.exitButton}?
                                </Dialog.Title>
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
                                    onClick={() => { setShowExitConfirm(false); onClose(); }}
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
