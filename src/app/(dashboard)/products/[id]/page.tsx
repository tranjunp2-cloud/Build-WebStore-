'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProductForm } from '@/components/dashboard/product-form/ProductForm'
import { ProductFormValues } from '@/components/dashboard/product-form/schema'
import { useI18n } from '@/i18n'
import { getProductAction, saveProductAction, deleteProductAction } from '../actions'
import { lexicalToText, descriptionEditPatch } from '@/lib/products/description-edit'
import { isFieldErrorsResult, parseServerError } from '@/lib/products/server-errors'
import { useSaveVersion } from '@/lib/save-version/use-save-version'
import { useInvalidateDomain } from '@/hooks/queries/use-invalidate-domain'
import { queryKeys } from '@/hooks/queries/query-keys'
import { getQueryClient, useQueryScope } from '@/providers/query-provider'

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** The product as the form shows it (the same mapping for the first load and for a reload after the copilot changed it). */
function toFormValues(data: any): Partial<ProductFormValues> {
    return {
        name: data.name || '',
        urlSlug: data.slug || '',
        description: lexicalToText(data.description) || '',
        categoryIds: Array.isArray(data.category) 
            ? data.category.map((c: any) => typeof c === 'string' ? c : c.id) 
            : [],
        images: data.images?.map((img: any) => ({
            id: typeof img.image === 'string' ? img.image : img.image?.id,
            url: typeof img.image === 'string' ? '' : (img.image?.url || ''),
            alt: img.alt || '',
        })).filter((i: any) => i.id) || [],
        
        hasVariants: Boolean(data.hasVariants),
        
        basePrice: data.price != null ? parseFloat(data.price) : undefined,
        compareAtPrice: data.compareAtPrice != null ? parseFloat(data.compareAtPrice) : undefined,
        baseInventory: data.inventory != null ? parseInt(data.inventory) : undefined,
        baseSku: data.sku || '',
        currency: data.currency || 'MYR',
        
        tiers: (data.variantConfigs || []).map((t: any, idx: number) => ({
            id: t.id || `tier-${idx}`,
            name: t.name || '',
            options: (t.options || []).map((o: any) => o.value)
        })),
        variants: (data.variants || []).map((v: any, index: number) => ({
            id: v.id || v.sku || `var-${index}`,
            variantName: v.name || '',
            skuCode: v.sku || '',
            price: v.price ? parseFloat(v.price) : 0,
            compareAtPrice: v.compareAtPrice != null ? parseFloat(v.compareAtPrice) : undefined,
            stock: v.stock !== undefined ? parseInt(v.stock) : 0,
        })),

        shippingWeight: data.weight ? parseFloat(data.weight) : undefined,
        shippingLength: data.dimensions?.length ? parseFloat(data.dimensions.length) : undefined,
        shippingWidth: data.dimensions?.width ? parseFloat(data.dimensions.width) : undefined,
        shippingHeight: data.dimensions?.height ? parseFloat(data.dimensions.height) : undefined,

        metaTitle: data.seo?.title || '',
        metaDescription: data.seo?.description || '',
        autoGenerateSeo: false, // UI default
        attributes: Array.isArray(data.attributes)
            ? data.attributes.map((a: any) => ({ key: a.key || '', value: a.value || '' }))
            : [],
    }
}

const hasLegacyVariantPrice = (data: any) => Boolean(data.hasVariants) && parseFloat(data.price ?? '0') === 0

export default function ProductEditPage() {
    const params = useParams()
    const router = useRouter()
    const { t } = useI18n()
    const productId = params?.id as string
    const isNew = productId === 'new'

    const [initialData, setInitialData] = useState<Partial<ProductFormValues> | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    // product missing / another shop's: no form while the redirect to the list completes
    const [unavailable, setUnavailable] = useState(false)
    const [showLegacyWarning, setShowLegacyWarning] = useState(false)
    // the product's updatedAt as loaded: sent with each save so a newer change is never written over
    const version = useSaveVersion()
    // after a save the page goes back to the list; a page already left must not pull the user back there
    const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    useEffect(() => () => clearTimeout(leaveTimer.current), [])
    // the products list is cached: a save, a delete or opening an AI draft (clears its review dot) makes it stale
    const invalidateDomain = useInvalidateDomain()
    const scope = useQueryScope()
    const listShowsAiReviewDot = () => getQueryClient()
        .getQueriesData<{ docs?: Array<{ id: string | number; aiReviewPending?: boolean }> }>({ queryKey: queryKeys.products.lists(scope) })
        .some(([, page]) => page?.docs?.some(row => String(row.id) === productId && row.aiReviewPending))

    useEffect(() => {
        if (isNew) {
            setInitialData({})
            setIsLoading(false)
            return
        }
        
        async function loadProduct() {
            try {
                const data = await getProductAction(productId)
                if (data) {
                    if (listShowsAiReviewDot()) void invalidateDomain('products')
                    setShowLegacyWarning(hasLegacyVariantPrice(data))
                    setInitialData(toFormValues(data))
                    version.set(data.updatedAt)
                } else {
                    // not found, or another shop's product (access-filtered): same answer, no form
                    toast.error(t.dashboard.products.form.notFound)
                    setUnavailable(true)
                    router.replace('/products')
                }
            } catch (err) {
                toast.error(t.dashboard.products.form.failedLoad)
            } finally {
                setIsLoading(false)
            }
        }
        loadProduct()
    }, [productId, isNew])

    // The copilot changed this product while the form is open: no spinner, the form swaps its values in place.
    const reloadProduct = async (isStillClean: () => boolean) => {
        const data = await getProductAction(productId)
        if (!data || !isStillClean()) return null
        const values = toFormValues(data)
        setShowLegacyWarning(hasLegacyVariantPrice(data))
        setInitialData(values)
        version.set(data.updatedAt)
        return values
    }

    const handleSave = async (data: ProductFormValues) => {
        try {
            const body = {
                name: data.name,
                slug: data.urlSlug || slugify(data.name),
                ...descriptionEditPatch(data.description, initialData?.description, isNew),
                price: data.basePrice ?? 0,
                compareAtPrice: data.compareAtPrice != null && data.compareAtPrice > 0 ? data.compareAtPrice : null,
                category: data.categoryIds,
                inventory: data.hasVariants ? (data.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0) : (data.baseInventory ?? 0),
                sku: data.baseSku || '',
                weight: data.shippingWeight || 0,
                dimensions: {
                    length: data.shippingLength || 0,
                    width: data.shippingWidth || 0,
                    height: data.shippingHeight || 0,
                },
                // Alt fallback ("{name} - {store}") is computed server-side (saveProductAction),
                // which has the tenant's store name — send the raw trimmed alt only (GH-1458).
                images: data.images?.map(img => ({ image: img.id, alt: img.alt?.trim() || '' })) || [],
                hasVariants: data.hasVariants,
                variantConfigs: data.hasVariants ? data.tiers?.map((t) => ({
                    name: t.name,
                    options: t.options.map((opt) => ({ value: opt }))
                })) || [] : [],
                variants: data.hasVariants ? data.variants?.map((v) => ({
                    name: v.variantName,          // Payload schema field: 'name'
                    sku: v.skuCode,               // Payload schema field: 'sku'
                    price: v.price,
                    compareAtPrice: v.compareAtPrice != null && v.compareAtPrice > 0 ? v.compareAtPrice : null,
                    stock: v.stock,
                })) || [] : [],
                seo: {
                    title: data.metaTitle,
                    description: data.metaDescription,
                },
                attributes: (data.attributes || [])
                    .filter((a) => a.key?.trim() && a.value?.trim())
                    .map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
                ...(isNew ? { status: 'draft' } : {}),
                currency: data.currency || 'MYR'
            }

            const saved = await saveProductAction(body, isNew ? undefined : productId, isNew ? undefined : version.current())
            if (version.refused(saved)) return { conflict: true as const }
            if (isFieldErrorsResult(saved)) return { fieldErrors: saved.fieldErrors }
            version.set(saved?.updatedAt)
            void invalidateDomain('products')

            toast.success(isNew ? t.dashboard.products.form.productCreated : t.dashboard.products.form.productUpdated)
            clearTimeout(leaveTimer.current)
            leaveTimer.current = setTimeout(() => {
                router.push('/products')
            }, 1500)
        } catch (err: any) {
            // Structured field errors (e.g. SKU conflict) are decoded and toasted by ProductForm — skip here
            if (!parseServerError(err)) {
                toast.error(err instanceof Error ? err.message : t.dashboard.products.form.networkError)
            }
            throw err
        }
    }

    const handleDelete = async () => {
        if (!confirm(t.dashboard.products.form.confirmDelete)) return;
        try {
            await deleteProductAction(productId);
            void invalidateDomain('products')
            toast.success(t.dashboard.products.form.deleteSuccess);
            router.push('/products');
        } catch (err) {
            toast.error(t.dashboard.products.form.networkError);
        }
    }

    if (isLoading || unavailable) {
        return (
            <div className="mx-auto max-w-3xl space-y-6 animate-pulse p-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/5" />
                    <div className="h-7 w-48 rounded bg-white/5" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[hsl(var(--secondary)/0.3)] p-6 h-64" />
                <div className="rounded-xl border border-white/10 bg-[hsl(var(--secondary)/0.3)] p-6 h-48" />
            </div>
        )
    }

    return (
        <div className="w-full">
            <ProductForm
                isEdit={!isNew}
                initialData={initialData || undefined}
                onSubmitForm={handleSave}
                showLegacyPriceWarning={showLegacyWarning}
                recordId={isNew ? undefined : productId}
                onReload={reloadProduct}
                version={version}
            />
        </div>
    )
}
