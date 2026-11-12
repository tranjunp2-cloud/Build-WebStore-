'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProductFormValues, getProductFormSchema } from './schema'
import { isNonEmptyTier } from './variant-utils'
import Link from 'next/link'
import { ChevronLeft, Check, Loader2, Trash2, ArrowLeft, AlertCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { parseServerError, localizeFieldError, type ServerFieldErrorEntry } from '@/lib/products/server-errors'
import { GeneralInfoSection } from './GeneralInfoSection'
import { MasterFieldsSection } from './MasterFieldsSection'
import { VariantOptionsSection } from './VariantOptionsSection'
import { ShippingDimensionsSection } from './ShippingDimensionsSection'
import { DescriptionSeoSection } from './DescriptionSeoSection'
import { AttributesSection } from './AttributesSection'
import { useMemo } from 'react'
import { useAgentChanges } from '@/lib/agent-changes/use-agent-changes'
import { useAgentRecordSync } from '@/lib/agent-changes/use-agent-record-sync'
import { AgentChangedNotice, SaveConflictNotice } from '@/components/agent/agent-changed-notice'
import type { SaveVersion } from '@/lib/save-version/use-save-version'
import { SaveBarLift } from '@/components/agent/save-bar-lift'

interface ProductFormProps {
    initialData?: Partial<ProductFormValues>;
    isEdit?: boolean;
    /** Resolves `{ conflict: true }` when the save was refused because the product changed after it was opened, or `{ fieldErrors }` for a server-side field error (e.g. duplicate SKU). */
    onSubmitForm?: (data: ProductFormValues) => Promise<{ conflict: true } | { fieldErrors: Record<string, ServerFieldErrorEntry> } | void>;
    /** GH-1032 legacy variant-price bug — product was saved with a variant matrix
     * but a base price of RM 0. Same warning as before, just relocated: rendered
     * in the header's right slot (next to the title) instead of a full-width block
     * above the form, so it no longer pushes the form sections down. */
    showLegacyPriceWarning?: boolean;
    /** The product being edited. With `onReload`, the form follows the copilot's changes to it. */
    recordId?: string;
    /** Loads the product again. Return null (or fail) to leave the form as is; call `isStillClean` after the fetch and
     * return null when the merchant typed meanwhile, so nothing they entered is replaced. */
    onReload?: (isStillClean: () => boolean) => Promise<Partial<ProductFormValues> | null>;
    /** The version of the product the form was loaded from; its conflict notice (Load the latest / Save mine anyway) shows here. */
    version?: SaveVersion;
}

/** Existing products that predate the required-slug constraint get a slug derived from the name. */
function withDerivedSlug(values: Partial<ProductFormValues>): Partial<ProductFormValues> {
    return {
        ...values,
        urlSlug: values.urlSlug ||
            (values.name ?? '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 60),
    }
}

export function ProductForm({ initialData, isEdit, onSubmitForm, showLegacyPriceWarning, recordId, onReload, version }: ProductFormProps) {
    const router = useRouter()
    const { t } = useI18n()
    const [isSaving, setIsSaving] = useState(false)
    const [categories, setCategories] = useState<import('../CategorySelect').Category[]>([])
    const fetchCategories = useCallback(async () => {
        try {
            const { getCategoriesAction } = await import('@/app/(dashboard)/products/categories/actions')
            const docs = await getCategoriesAction()
            setCategories(docs || [])
        } catch (err) {
            console.error('Failed to fetch categories:', err)
        }
    }, [])

    const [baselineAttributes, setBaselineAttributes] = useState(initialData?.attributes)
    const schema = useMemo(() => getProductFormSchema(t, isEdit ? initialData?.images : undefined,
        { isEdit, attributes: baselineAttributes }), [t, isEdit, initialData?.images, baselineAttributes])

    const methods = useForm<ProductFormValues>({
        resolver: async (values, context, options) => {
            const payload = values.hasVariants === false 
                ? { ...values, variants: [], tiers: [] } 
                : values;
            return zodResolver(schema)(payload, context, options);
        },
        defaultValues: initialData ? withDerivedSlug(initialData) : {
            name: '',
            categoryIds: [],
            images: [],
            description: '',
            hasVariants: false,
            basePrice: 0,
            compareAtPrice: 0,
            baseInventory: 0,
            baseSku: '',
            autoGenerateSeo: false,
            tiers: [],
            variants: [],
            shippingWeight: undefined,
            shippingLength: undefined,
            shippingWidth: undefined,
            shippingHeight: undefined,
            metaTitle: '',
            metaDescription: '',
            urlSlug: '',
            attributes: [],
        }
    })

    // Mount logic for hydration, default registrations, and fetch categories
    const [mounted, setMounted] = useState(false)
    
    // Auto re-validate fields that have errors when language changes
    useEffect(() => {
        const errorKeys = Object.keys(methods.formState.errors) as (keyof ProductFormValues)[]
        if (errorKeys.length > 0) {
            methods.trigger(errorKeys)
        }
    }, [t, methods])

    useEffect(() => {
        setMounted(true)
        
        // Explicitly register custom array fields so RHF doesn't strip them before Zod validation
        methods.register('categoryIds')
        methods.register('images')

        void fetchCategories()
    }, [methods.register, fetchCategories])

    // The assistant created, renamed or re-parented categories: the picker lists them without a reload
    useAgentChanges({ kinds: ['store_category'] }, () => { void fetchCategories() })

    // The assistant changed this product: with no unsaved edits the form is replaced in place (the sections, scroll and
    // open fields stay); with edits, the notice asks first. "Keep mine" keeps the edits, and the next save is refused
    // as a conflict (the form's version is the old one) until the merchant loads the latest or saves anyway.
    const dirtyRef = useRef(false)
    dirtyRef.current = methods.formState.isDirty
    // the merchant chose Reload in the notice: their edits are meant to be replaced
    const discardEdits = useRef(false)
    const sync = useAgentRecordSync({
        kind: 'product',
        id: isEdit && onReload ? recordId : undefined,
        dirty: methods.formState.isDirty,
        reload: async () => {
            const force = discardEdits.current
            discardEdits.current = false
            const stillClean = () => force || !dirtyRef.current
            try {
                const next = await onReload?.(stillClean)
                if (next && stillClean()) {
                    setBaselineAttributes(next.attributes)
                    methods.reset(withDerivedSlug(next))
                }
            } catch (err) {
                console.error('Failed to reload product:', err)
            }
        },
    })

    /** Inline error per field + scroll to the first one + a localized toast (falls back to `fallbackMessage`). */
    const applyFieldErrors = (fieldErrors: Record<string, ServerFieldErrorEntry>, fallbackMessage?: string) => {
        const errorsMap = t.dashboard.products.form.errors as Record<string, string>
        const messages: string[] = []
        for (const [path, entry] of Object.entries(fieldErrors)) {
            const message = localizeFieldError(entry, errorsMap)
            messages.push(message)
            // Inline highlight is best-effort; toast below always fires as primary feedback.
            methods.setError(path as Parameters<typeof methods.setError>[0], { type: 'server', message })
        }
        const firstPath = Object.keys(fieldErrors)[0]
        if (firstPath) {
            const el = document.querySelector(`[name="${firstPath}"]`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            else window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        toast.error(messages[0] ?? fallbackMessage ?? t.dashboard.products.form.somethingWentWrong)
    }

    const onSubmit = async (data: ProductFormValues) => {
        setIsSaving(true)
        // Strip fully-empty optional tiers before sending to API
        const payload = {
            ...data,
            tiers: (data.tiers || []).filter(isNonEmptyTier),
        }
        try {
            if (onSubmitForm) {
                const outcome = await onSubmitForm(payload);
                if (outcome && 'conflict' in outcome) return
                if (outcome && 'fieldErrors' in outcome) {
                    applyFieldErrors(outcome.fieldErrors)
                    return
                }
            } else {
                console.log('Form data:', data)
                toast.success(t.dashboard.products.form.draftSaved)
                // Delay and redirect
                setTimeout(() => {
                    router.push('/products')
                }, 1000)
            }
            // Clear isDirty so the save-bar footer doesn't flip back to "Unsaved changes"
            // during the redirect delay right after a confirmed-successful save.
            setBaselineAttributes(data.attributes)
            methods.reset(data)
        } catch (error) {
            const parsed = parseServerError(error)
            if (parsed) {
                applyFieldErrors(parsed.fieldErrors, parsed.message)
            } else {
                toast.error(error instanceof Error ? error.message : t.dashboard.products.form.somethingWentWrong)
            }
        } finally {
            setIsSaving(false)
        }
    }

    const onInvalid = (errors: any) => {
        // Find the first error element to scroll to it
        const errorKeys = Object.keys(errors)
        if (errorKeys.length > 0) {
            const firstErrorKey = errorKeys[0]
            // For custom components like categoryIds, images we might not have a direct name attribute on a visible input
            // But we can try to find an element that has `name="fieldName"` or `id="fieldName"` or just scroll to top if not found
            const el = document.querySelector(`[name="${firstErrorKey}"], #${firstErrorKey}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' })
            }

            // Create a user-friendly error message list
            const errorMessages = errorKeys.map((key) => {
                const map: Record<string, string> = {
                    name: t.dashboard.products.form.fields.name || 'Product Name',
                    categoryIds: t.dashboard.products.form.fields.categoryIds || 'Category',
                    images: t.dashboard.products.form.fields.images || 'Images',
                    // GH-2096: these used to show as raw keys ("shippingWeight", "compareAtPrice")
                    shippingWeight: t.dashboard.products.form.fields.weight || 'Weight',
                    compareAtPrice: t.dashboard.products.form.fields.compareAtPrice || 'Compare-at price',
                    variants: t.dashboard.products.form.fields.variants || 'Variants Matrix',
                    tiers: t.dashboard.products.form.fields.tiers || 'Variant Options',
                    basePrice: t.dashboard.products.form.fields.basePrice || 'Price',
                    baseSku: t.dashboard.products.form.fields.baseSku || 'SKU Code',
                    baseInventory: t.dashboard.products.form.fields.baseInventory || 'Inventory',
                    urlSlug: t.dashboard.products.form.sections?.urlSlug || 'URL Slug',
                    attributes: t.dashboard.products.form.sections?.attributes || 'Extended Information (Attributes)',
                }
                return map[key] || key
            })
            
            toast.error(`${t.dashboard.products.form.checkFields} ${errorMessages.join(', ')}`)
        } else {
            toast.error(t.dashboard.products.form.checkAllRequired)
        }
    }

    if (!mounted) return null;

    // Prevent the browser's native "submit form on Enter" behavior when the user is
    // typing in a plain text/number field — pressing Enter while filling in any field
    // (e.g. Price, SKU) should never silently trigger Save Draft/Save Changes.
    // Scoped to <input> elements only: textareas (Description) keep Enter for
    // newlines, and buttons/custom widgets are unaffected.
    const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault()
        }
    }

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)} onKeyDown={handleFormKeyDown} className="relative flex flex-col w-full">
                {version?.conflicted ? (
                    <div className="mb-6">
                        <SaveConflictNotice
                            record="product"
                            onLoadLatest={() => { discardEdits.current = true; sync.reloadNow() }}
                            onSaveAnyway={() => { version.overwrite(); void methods.handleSubmit(onSubmit, onInvalid)() }}
                        />
                    </div>
                ) : sync.stale && (
                    <div className="mb-6">
                        <AgentChangedNotice record="product" onReload={() => { discardEdits.current = true; sync.reloadNow() }} onKeep={sync.keepMine} />
                    </div>
                )}

                {/* Header — `flex-wrap` so the legacy-price warning (below) drops to its own
                    full-width row on narrow viewports instead of squeezing the title into a
                    cramped column; unaffected on desktop where both sit on one row. */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/products" className="flex shrink-0 items-center justify-center text-foreground hover:text-foreground/80 transition-colors">
                            <ArrowLeft className="h-6 w-6" />
                        </Link>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-[24px] font-bold font-outfit text-foreground leading-[1.33] m-0">
                                {isEdit ? t.dashboard.products.form.editProduct : t.dashboard.products.addProduct}
                            </h1>
                            <p className="text-[14px] text-foreground/60 leading-[1.43] m-0">{t.dashboard.products.form.fillInfo}</p>
                        </div>
                    </div>
                    {showLegacyPriceWarning && (
                        <div
                            role="alert"
                            className="flex items-start gap-3 w-full md:w-auto md:max-w-md rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] text-warning"
                        >
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
                            <span>{t.dashboard.products.form.legacyPriceWarning}</span>
                        </div>
                    )}
                </div>

                {/* Form sections */}
                <div className="flex flex-col gap-6 pb-24">
                    <GeneralInfoSection categories={categories} isEdit={isEdit} />
                    <div className="rounded-2xl border border-solid border-slate-200 dark:border-white/[0.15] bg-white dark:bg-[hsl(var(--card))] p-[25px] flex flex-col gap-6">
                        <h2 className="text-[18px] font-semibold text-foreground leading-[1.56] font-outfit m-0">{t.dashboard.products.form.sections?.variants || 'Variants & Inventory'}</h2>
                        <MasterFieldsSection />
                        <VariantOptionsSection />
                    </div>
                    <ShippingDimensionsSection />
                    <DescriptionSeoSection />
                    <AttributesSection />
                </div>

                {/* Save bar — GH-1509 design-system pass (PR #1512): floating card,
                    `--save-bar-bg` token, amber "unsaved changes" indicator, size="sm" buttons —
                    same template now shared by Payments/Shipping/Discounts/Customers-detail.
                    Only renders while dirty (was previously always visible, cycling
                    "New product"/"Unsaved changes"/"Up to date" status text).
                    `position: fixed` (not `sticky`) so it always sits bottom-4 from the viewport
                    regardless of content length, instead of drifting until scrolled past its
                    natural flow position. `--dash-content-pl` (globals.css, GH-1592) aligns the
                    left edge with the content column (sidebar + p-8 gutter) at lg+. */}
                {methods.formState.isDirty && (
                    <div
                        data-save-bar=""
                        className="fixed z-40 bottom-4 left-4 right-4 lg:left-[var(--dash-content-pl)] lg:right-8 flex flex-wrap items-center justify-between gap-y-2 px-[18px] py-[12px] rounded-[14px] border border-solid border-[hsl(var(--border))]"
                        style={{ background: 'var(--save-bar-bg)', boxShadow: 'var(--save-bar-shadow)' }}
                    >
                        <SaveBarLift />
                        <div className="flex items-center gap-2 text-[13px]">
                            <AlertCircle className="w-[14px] h-[14px] text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-amber-600 dark:text-amber-300 font-medium">{t.dashboard.products.form.unsavedChanges}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                onClick={() => router.push('/products')}
                                disabled={isSaving}
                                variant="dashSecondary"
                                size="sm"
                            >
                                {t.dashboard.products.form.cancel}
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isSaving}
                            >
                                {isSaving
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Check className="h-3.5 w-3.5" />
                                }
                                {isSaving ? t.dashboard.products.form.saving : isEdit ? t.dashboard.products.form.saveChanges : t.dashboard.products.form.saveDraft}
                            </Button>
                        </div>
                    </div>
                )}
            </form>
        </FormProvider>
    )
}
