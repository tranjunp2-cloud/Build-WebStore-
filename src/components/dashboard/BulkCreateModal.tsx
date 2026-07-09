'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { saveProductAction } from '@/app/(dashboard)/products/actions'
import { useI18n } from '@/i18n'
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll'

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
    selected: boolean
    name: string
    price: number
    compareAtPrice?: number
    category: string
    description?: string
    seoTitle?: string
    seoDescription?: string
    slug?: string
    sku?: string
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
                stock: Number(v.stock ?? 0),
                sku: sanitizeXSS(v.sku || '').trim() || generateFallbackSku(`${safeName}-${v.name || defaultVariantName}`)
            }
        }) : undefined,
        inventory: 0, // Out of stock by default until the merchant confirms real stock; mapped to `inventory` in schema
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
                                uniqueMap.set(key, { ...v, name: truncatedName });
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
        const selectedProducts = products.filter(p => p.selected)
        if (selectedProducts.length === 0) {
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

            for (const prod of selectedProducts) {
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

    const toggleSelectAll = (checked: boolean) => {
        setProducts(prev => prev.map(p => ({ ...p, selected: checked })))
    }

    const handleClose = () => {
        if (hasParsed && products.length > 0 && !isSaving) {
            setShowExitConfirm(true)
            return
        }
        onClose()
    }

    const selectedCount = products.filter(p => p.selected).length

    if (!mounted) return null

    const modal = createPortal(
        // `dash-shell` sits on this wrapper (not the overlay div below) so the theme-aware
        // `.dash-shell .bg-black/60` override in globals.css (AC-5: light 0.4 / dark 0.7)
        // actually matches as a descendant selector — putting both classes on the same
        // element would never match (a descendant selector can't match an element against
        // itself), silently falling back to Tailwind's flat bg-black/60 (0.6) in both themes.
        <div className="dash-shell">
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-[#F8FAFC] antialiased"
            style={{ fontFamily: "'Inter', sans-serif" }}
        >
            <div className="flex flex-col max-h-[90vh] w-full max-w-[896px] rounded-[24px] bg-[#1E293B] shadow-2xl border border-white/[0.08] overflow-hidden">
                {/* Header Container 30963:11535 */}
                <div className="flex flex-col gap-1 p-[24px_24px_24px_24px] border-b border-white/[0.08]">
                    {/* Header Row */}
                    <div className="flex items-center gap-[10px]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 2L12.5 8.5L19 11L12.5 13.5L10 20L7.5 13.5L1 11L7.5 8.5L10 2Z" stroke="#2DD4BF" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M19 2L20.25 5.25L23.5 6.5L20.25 7.75L19 11L17.75 7.75L14.5 6.5L17.75 5.25L19 2Z" fill="#FBBF24"/>
                        </svg>
                        <h2 className="text-[20px] font-bold text-[#F8FAFC]">
                            {t.dashboard?.products?.bulkCreate?.title || 'Confirm Create Products (AI Preview)'}
                        </h2>
                    </div>
                    {/* Description */}
                    <p className="text-[14px] text-dash-text-muted">
                        {t.dashboard?.products?.bulkCreate?.subtitle || 'Review and edit before saving'}
                    </p>
                </div>

                {/* Body Container 30963:11547 */}
                <div className="flex-1 overflow-y-auto px-[24px] pt-[24px] pb-6 flex flex-col">
                    {isParsing ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
                            <p className="text-dash-text-muted text-[14px] font-medium">{t.dashboard?.products?.bulkCreate?.aiWorking || 'AI magic is working...'}</p>
                        </div>
                    ) : (
                        <>
                            {/* Table Container 30963:11548 */}
                            <div className="rounded-2xl bg-black/[0.04] dark:bg-[#0B1120]/30 overflow-hidden shrink-0">
                                <table className="w-full text-left border-collapse table-fixed">
                                    {/* Table Header 30963:11550 */}
                                    <thead className="bg-black/[0.06] dark:bg-[#0B1120]/60 h-[48px]">
                                        <tr>
                                            <th className="w-[48px] align-middle text-center pl-2">
                                                <label className="relative flex items-center justify-center cursor-pointer w-[14px] h-[14px]">
                                                    <input
                                                        type="checkbox"
                                                        checked={products.length > 0 && products.every(p => p.selected)}
                                                        onChange={(e) => toggleSelectAll(e.target.checked)}
                                                        className="peer sr-only"
                                                    />
                                                    <div className="w-[14px] h-[14px] rounded-[3px] border border-white/20 bg-[#1E293B] peer-checked:bg-[#93C5FD] peer-checked:border-[#93C5FD] flex items-center justify-center transition-colors">
                                                        {(products.length > 0 && products.every((p) => p.selected)) && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-[10px] h-[10px] text-[#0F172A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </label>
                                            </th>
                                            <th className="align-middle text-[11px] font-bold text-dash-text-muted w-[110px] md:w-[322px] px-2 tracking-wider">{t.dashboard?.products?.bulkCreate?.table?.name || 'NAME'}</th>
                                            <th className="align-middle text-[11px] font-bold text-dash-text-muted w-[90px] md:w-[322px] px-2 tracking-wider">{t.dashboard?.products?.bulkCreate?.table?.price || 'PRICE'}</th>
                                            <th className="align-middle text-[11px] font-bold text-dash-text-muted w-[70px] md:w-auto px-2 tracking-wider">{t.dashboard?.products?.bulkCreate?.table?.variants || 'VARIANTS'}</th>
                                        </tr>
                                    </thead>
                                    {/* Table Body 30963:11560 */}
                                    <tbody>
                                        {products.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="h-[62px] text-center text-dash-text-muted text-[14px]">
                                                    {t.dashboard?.products?.bulkCreate?.table?.empty || 'Product list is empty.'}
                                                </td>
                                            </tr>
                                        ) : products.map((p) => {
                                            // Calculate approximate lines for textarea auto-sizing (assuming ~15 chars per line on mobile 110px width)
                                            const nameLines = Math.max(1, Math.ceil((p.name.length || 1) / 14));
                                            
                                            return (
                                                <tr key={p._id} className="h-[64px] border-t border-white/[0.04]">
                                                    <td className="w-[48px] align-middle text-center pl-2">
                                                        <label className="relative flex items-center justify-center cursor-pointer w-[14px] h-[14px]">
                                                            <input
                                                                type="checkbox"
                                                                checked={p.selected}
                                                                onChange={(e) => updateProduct(p._id!, 'selected', e.target.checked)}
                                                                className="peer sr-only"
                                                            />
                                                            <div className="w-[14px] h-[14px] rounded-[3px] border border-white/20 bg-[#1E293B] peer-checked:bg-[#93C5FD] peer-checked:border-[#93C5FD] flex items-center justify-center transition-colors">
                                                                {p.selected && (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-[10px] h-[10px] text-[#0F172A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                        </label>
                                                    </td>
                                                    <td className="align-middle px-2 py-3">
                                                        <textarea
                                                            value={p.name}
                                                            onChange={(e) => updateProduct(p._id!, 'name', e.target.value)}
                                                            rows={nameLines}
                                                            className="w-[calc(100%-4px)] md:w-full min-h-[36px] bg-[#1E293B] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] md:text-[14px] text-[#F8FAFC] placeholder-gray-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors resize-none overflow-hidden"
                                                            style={{ height: `${Math.max(36, nameLines * 20 + 16)}px` }}
                                                        />
                                                    </td>
                                                    <td className="align-middle px-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={p.price}
                                                            onChange={(e) => updateProduct(p._id!, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                                                            className="w-[calc(100%-4px)] md:w-full h-[36px] bg-[#1E293B] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] md:text-[14px] text-[#F8FAFC] placeholder-gray-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                                                        />
                                                    </td>
                                                    <td className="align-middle px-2">
                                                        <div className="text-[12px] md:text-[14px] text-dash-text-muted max-w-[60px] md:max-w-full truncate break-words whitespace-normal leading-tight">
                                                            {p.variants?.length ? p.variants.map(v => v.name).join(', ') : (t.dashboard?.products?.bulkCreate?.table?.defaultVariant || 'Default')}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Note Container 30963:11573 */}
                            {products.length > 0 && (
                                <div className="rounded-2xl bg-teal-400/5 border border-teal-400/20 p-4 mt-6 shrink-0">
                                    <p className="text-[14px] leading-snug">
                                        <span className="font-bold text-[#2DD4BF]">{t.dashboard?.products?.bulkCreate?.note?.label || 'Note: '}</span>
                                        <span className="text-dash-text-muted">{t.dashboard?.products?.bulkCreate?.note?.description || 'Products will be saved as Draft'}</span>
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Container 30963:11576 */}
                <div className="flex w-full gap-[12px] p-[24px_24px_24px_24px] border-t border-white/[0.08]">
                    <button
                        onClick={handleClose}
                        disabled={isSaving}
                        className="flex-1 h-[50px] rounded-2xl bg-transparent border border-solid border-[#F8FAFC]/30 text-[16px] font-medium text-[#F8FAFC] hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.dashboard?.products?.bulkCreate?.cancel || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isParsing || selectedCount === 0}
                        className="flex-1 h-[50px] rounded-2xl bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] text-[16px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {t.dashboard?.products?.bulkCreate?.saveButton || 'Save'} {selectedCount} {t.dashboard?.products?.bulkCreate?.productsItem || 'Products'}
                    </button>
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
