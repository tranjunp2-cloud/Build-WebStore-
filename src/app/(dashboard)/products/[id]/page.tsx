'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Save, Sparkles, Loader2, Package,
    Plus, Trash2, Upload as UploadIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ProductImageFallback } from '@/components/dashboard/ProductImageFallback'
import { ImageUploader, type UploadedImage } from '@/components/dashboard/ImageUploader'
import { useI18n } from '@/i18n'

const lexicalToText = (data: any): string => {
    if (!data || !data.root || !data.root.children) return typeof data === 'string' ? data : '';
    let text = '';
    const traverse = (node: any) => {
        if (node.type === 'text') text += node.text;
        else if (node.type === 'paragraph') {
            node.children?.forEach(traverse);
            text += '\n\n';
        } else if (node.children) node.children.forEach(traverse);
    };
    traverse(data.root);
    return text.trim();
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

type ProductForm = {
    name: string
    slug: string
    shortDescription: string
    description?: string
    descriptionBM?: string
    price: string
    compareAtPrice: string
    currency: string
    category: string
    status: 'draft' | 'active' | 'archived'
    inventory: string
    sku: string
    weight: string
    length: string
    width: string
    height: string
    seoTitle: string
    seoDescription: string
    images: UploadedImage[]
    halalCertified: boolean
    halalCertImage: UploadedImage | null
}

const initialForm: ProductForm = {
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    descriptionBM: '',
    price: '',
    compareAtPrice: '',
    currency: 'MYR',
    category: '',
    status: 'draft',
    inventory: '0',
    sku: '',
    weight: '0',
    length: '0',
    width: '0',
    height: '0',
    seoTitle: '',
    seoDescription: '',
    images: [],
    halalCertified: false,
    halalCertImage: null,
}

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function ProductEditPage() {
    const params = useParams()
    const router = useRouter()
    const productId = params?.id as string
    const isNew = productId === 'new'
    const { t } = useI18n()

    const [form, setForm] = useState<ProductForm>(initialForm)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isConfirmDelete, setIsConfirmDelete] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [descTab, setDescTab] = useState<'en'|'bm'>('en')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Load product if editing
    useEffect(() => {
        if (isNew) return
        async function loadProduct() {
            try {
                const res = await fetch(`/api/products/${productId}`, { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    setForm({
                        name: data.name || '',
                        slug: data.slug || '',
                        shortDescription: data.shortDescription || '',
                        description: lexicalToText(data.description),
                        descriptionBM: lexicalToText(data.descriptionBM),
                        price: String(data.price || ''),
                        compareAtPrice: String(data.compareAtPrice || ''),
                        currency: data.currency || 'MYR',
                        category: data.category || '',
                        status: data.status || 'draft',
                        inventory: String(data.inventory || 0),
                        sku: data.sku || '',
                        weight: String(data.weight || 0),
                        length: String(data.dimensions?.length || 0),
                        width: String(data.dimensions?.width || 0),
                        height: String(data.dimensions?.height || 0),
                        seoTitle: data.seo?.title || '',
                        seoDescription: data.seo?.description || '',
                        images: data.images?.map((img: any) => ({
                            id: typeof img.image === 'string' ? img.image : img.image?.id,
                            url: typeof img.image === 'string' ? '' : (img.image?.url || ''),
                        })).filter((i: any) => i.id) || [],
                        halalCertified: Boolean(data.halalCertified),
                        halalCertImage: data.halalCertImage ? {
                            id: typeof data.halalCertImage === 'string' ? data.halalCertImage : data.halalCertImage.id,
                            url: typeof data.halalCertImage === 'string' ? '' : (data.halalCertImage?.url || ''),
                        } : null,
                    })
                }
            } catch (err) {
                setError('Failed to load product')
                toast.error('Failed to load product')
            } finally {
                setIsLoading(false)
            }
        }
        loadProduct()
    }, [productId, isNew])

    const updateField = (field: keyof ProductForm, value: any) => {
        setForm(prev => {
            const updated = { ...prev, [field]: value }
            if (field === 'name' && (isNew || !prev.slug)) {
                updated.slug = slugify(value)
            }
            return updated
        })
        // Clear error when typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }))
        }
    }

    const handleSave = async () => {
        const newErrors: Record<string, string> = {}
        
        if (!form.name.trim() || form.name.length < 3) {
            newErrors.name = t.dashboard.products.form.errors.nameMin
        }
        if (!form.price || parseFloat(form.price) < 0) {
            newErrors.price = t.dashboard.products.form.errors.priceRequired
        }
        if (!form.sku.trim()) {
            newErrors.sku = t.dashboard.products.form.errors.skuRequired
        }
        if (!form.category.trim()) {
            newErrors.category = t.dashboard.products.form.errors.categoryRequired
        }
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            toast.error(t.dashboard.products.form.errors.checkErrors)
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            const body = {
                name: form.name,
                slug: form.slug || slugify(form.name),
                shortDescription: form.shortDescription,
                description: form.description ? textToLexical(form.description) : undefined,
                descriptionBM: form.descriptionBM ? textToLexical(form.descriptionBM) : undefined,
                price: parseFloat(form.price),
                compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
                currency: form.currency,
                category: form.category,
                status: form.status,
                inventory: parseInt(form.inventory) || 0,
                sku: form.sku,
                weight: parseFloat(form.weight) || 0,
                dimensions: {
                    length: parseFloat(form.length) || 0,
                    width: parseFloat(form.width) || 0,
                    height: parseFloat(form.height) || 0,
                },
                images: form.images.map(img => ({ image: img.id, alt: form.name })),
                halalCertified: form.halalCertified,
                halalCertImage: form.halalCertImage ? form.halalCertImage.id : null,
                seo: {
                    title: form.seoTitle,
                    description: form.seoDescription,
                },
            }

            const url = isNew ? '/api/products' : `/api/products/${productId}`
            const method = isNew ? 'POST' : 'PATCH'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            })

            if (res.ok) {
                setSuccess(true)
                if (isNew && form.status === 'draft') {
                    toast.success(t.dashboard.products.form.toastDraft)
                } else {
                    toast.success(t.dashboard.products.form.toastSaved)
                }
                setTimeout(() => {
                    router.push('/products')
                }, 1500)
            } else {
                const data = await res.json()
                const msg = data.error?.message || 'Failed to save'
                setError(msg)
                toast.error(msg)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Network error'
            setError(message)
            toast.error(message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deletedAt: new Date().toISOString() })
            })
            if (res.ok) {
                toast(t.dashboard.products.form.toastDeleted, {
                    action: {
                        label: t.dashboard.products.form.undo,
                        onClick: async () => {
                            await fetch(`/api/products/${productId}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ deletedAt: null })
                            })
                            toast.success(t.dashboard.products.form.toastRestored)
                        }
                    },
                    duration: 5000,
                })
                router.push('/products')
            } else {
                toast.error(t.dashboard.products.form.deleteFailed)
            }
        } catch (e) {
            toast.error(t.dashboard.products.form.networkError)
        } finally {
            setIsDeleting(false)
            setIsConfirmDelete(false)
        }
    }

    const handleAIGenerate = async () => {
        if (!form.name.trim()) {
            setError('Enter a product name first')
            return
        }
        setIsGenerating(true)
        setError(null)

        try {
            const res = await fetch('/api/products/generate-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: form.name,
                    category: form.category,
                }),
            })

            if (res.ok) {
                const data = await res.json()
                if (data.success && data.data) {
                    setForm(prev => ({
                        ...prev,
                        description: data.data.descriptionEN || prev.description,
                        descriptionBM: data.data.descriptionBM || prev.descriptionBM,
                        shortDescription: data.data.shortDescription || prev.shortDescription,
                        seoTitle: data.data.seoTitle || prev.seoTitle,
                        seoDescription: data.data.seoDescription || prev.seoDescription,
                    }))
                    toast.success('AI generation complete!')
                }
            }
        } catch (err) {
            setError('AI generation failed')
            toast.error('AI generation failed')
        } finally {
            setIsGenerating(false)
        }
    }

    if (isLoading) {
        return (
            <div className="mx-auto max-w-3xl space-y-6 animate-pulse p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-white/5" />
                        <div className="h-7 w-48 rounded bg-white/5" />
                    </div>
                    <div className="h-10 w-32 rounded-lg bg-white/5" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                    <div className="h-4 w-32 rounded bg-white/5" />
                    <div className="h-10 w-full rounded-lg bg-white/5" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="h-10 rounded-lg bg-white/5" />
                        <div className="h-10 rounded-lg bg-white/5" />
                    </div>
                    <div className="h-20 w-full rounded-lg bg-white/5" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                    <div className="h-4 w-36 rounded bg-white/5" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="h-10 rounded-lg bg-white/5" />
                        <div className="h-10 rounded-lg bg-white/5" />
                        <div className="h-10 rounded-lg bg-white/5" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/products"
                        aria-label="Back to products"
                        className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="text-2xl font-bold text-white">
                        {isNew ? t.dashboard.products.form.newTitle : `${t.dashboard.products.form.editTitle}: ${form.name}`}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {!isNew && (
                        <button onClick={() => setIsConfirmDelete(true)} disabled={isDeleting}
                            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-4 w-4" /> {t.dashboard.products.form.delete}
                        </button>
                    )}
                    <button onClick={handleSave} disabled={isSaving || success}
                        className={cn('flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors shadow-lg',
                            success ? 'bg-green-600 shadow-green-500/25' : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-500')}>
                        {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                            : success ? <><Package className="h-4 w-4" /> Saved!</>
                                : <><Save className="h-4 w-4" /> Save Product</>}
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {isConfirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl bg-[#1E293B] p-6 shadow-2xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-2">{t.dashboard.products.form.deleteConfirmTitle}</h3>
                        <p className="text-sm text-gray-400 mb-6">{t.dashboard.products.form.deleteConfirmText} <strong>&quot;{form.name}&quot;</strong>? {t.dashboard.products.form.deleteConfirmRestorable}</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsConfirmDelete(false)} disabled={isDeleting}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors">
                                {t.dashboard.products.form.cancel}
                            </button>
                            <button onClick={handleDelete} disabled={isDeleting}
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-red-500 focus:outline-none">
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                {t.dashboard.products.form.confirmDeleteBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* Images */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <ImageUploader
                    value={form.images}
                    onChange={imgs => updateField('images', imgs)}
                    maxImages={5}
                    maxSizeMB={5}
                />
            </div>

            {/* Basic Info */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-gray-500">{t.dashboard.products.form.basicInfo}</h2>

                <div>
                    <label className="text-xs font-medium text-gray-400">Product Name *</label>
                    <input value={form.name} onChange={e => updateField('name', e.target.value)}
                        placeholder="e.g. Premium Nasi Lemak Set"
                        className={cn("mt-1.5 w-full rounded-lg border bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none",
                            errors.name ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-blue-500/50")} />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-400">Slug</label>
                        <input value={form.slug} onChange={e => updateField('slug', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">Category *</label>
                        <input value={form.category} onChange={e => updateField('category', e.target.value)}
                            placeholder="e.g. Food, Electronics"
                            className={cn("mt-1.5 w-full rounded-lg border bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none",
                                errors.category ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-blue-500/50")} />
                        {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2 bg-[#0B1120] rounded-lg p-1 border border-white/10">
                            <button onClick={() => setDescTab('en')}
                                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", 
                                    descTab === 'en' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}>EN</button>
                            <button onClick={() => setDescTab('bm')}
                                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", 
                                    descTab === 'bm' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}>BM</button>
                        </div>
                        <button onClick={handleAIGenerate} disabled={isGenerating || !form.name.trim()}
                            className="flex items-center gap-1 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50 ml-auto border border-purple-500/20">
                            {isGenerating ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                                : <><Sparkles className="h-3 w-3" /> Auto Magic</>}
                        </button>
                    </div>
                    {descTab === 'en' ? (
                        <div className="space-y-4 mt-4">
                            <div>
                                <label className="text-xs font-medium text-gray-400">Short Description (Cards/SEO) *</label>
                                <textarea value={form.shortDescription} onChange={e => updateField('shortDescription', e.target.value)}
                                    rows={2} maxLength={300} placeholder="Product short description in English..."
                                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 resize-none" />
                                <p className="mt-1 text-[10px] text-gray-600">{form.shortDescription.length}/300</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-400">Full Description</label>
                                <textarea value={form.description || ''} onChange={e => updateField('description', e.target.value)}
                                    rows={5} placeholder="Full description in English..."
                                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 resize-none" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 mt-4">
                            <div>
                                <label className="text-xs font-medium text-gray-400">Full Description (Bahasa Melayu)</label>
                                <textarea value={form.descriptionBM || ''} onChange={e => updateField('descriptionBM', e.target.value)}
                                    rows={5} placeholder="Full description in Bahasa Melayu..."
                                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 resize-none" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Halal Certification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3 p-4 rounded-lg border border-white/10 bg-[#0B1120]">
                        <input type="checkbox" checked={form.halalCertified}
                            onChange={e => updateField('halalCertified', e.target.checked)}
                            className="h-4 w-4 rounded border-white/10 bg-transparent text-blue-600 focus:ring-blue-500/50" />
                        <div className="flex-1">
                            <label className="text-sm font-medium text-white">Halal Certified</label>
                            <p className="text-xs text-gray-400">Mark product as Halal Certified (JAKIM)</p>
                        </div>
                    </div>
                </div>
                {form.halalCertified && (
                    <div>
                        <ImageUploader
                            label="Halal Certificate Image"
                            description="Upload JAKIM Halal certificate image"
                            value={form.halalCertImage ? [form.halalCertImage] : []}
                            onChange={imgs => updateField('halalCertImage', imgs[0] || null)}
                            maxImages={1}
                        />
                    </div>
                )}
            </div>

            {/* Pricing */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-gray-500">Pricing & Inventory</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-400">Price *</label>
                        <div className={cn("mt-1.5 flex items-center rounded-lg border overflow-hidden",
                            errors.price ? "border-red-500 focus-within:border-red-500" : "border-white/10 bg-[#0B1120] focus-within:border-blue-500/50")}>
                            <span className="px-3 text-xs text-gray-500 bg-white/5 border-r border-white/10">{form.currency === 'MYR' ? 'RM' : '$'}</span>
                            <input type="number" step="0.01" min="0" value={form.price}
                                onChange={e => updateField('price', e.target.value)}
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none" />
                        </div>
                        {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price}</p>}
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">Compare Price</label>
                        <div className="mt-1.5 flex items-center rounded-lg border border-white/10 bg-[#0B1120] overflow-hidden focus-within:border-blue-500/50">
                            <span className="px-3 text-xs text-gray-500 bg-white/5">{form.currency === 'MYR' ? 'RM' : '$'}</span>
                            <input type="number" step="0.01" min="0" value={form.compareAtPrice}
                                onChange={e => updateField('compareAtPrice', e.target.value)}
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">Currency</label>
                        <select value={form.currency} onChange={e => updateField('currency', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none">
                            <option value="MYR">MYR (RM)</option>
                            <option value="USD">USD ($)</option>
                            <option value="SGD">SGD (S$)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div>
                        <label className="text-xs font-medium text-gray-400">Inventory</label>
                        <input type="number" min="0" value={form.inventory}
                            onChange={e => updateField('inventory', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">SKU *</label>
                        <input value={form.sku} onChange={e => updateField('sku', e.target.value)}
                            placeholder="e.g. NL-PREM-001"
                            className={cn("mt-1.5 w-full rounded-lg border bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none",
                                errors.sku ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-blue-500/50")} />
                        {errors.sku && <p className="mt-1 text-xs text-red-500">{errors.sku}</p>}
                    </div>
                </div>
            </div>

            {/* Shipping Information */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-gray-500">{t.dashboard.products.form.shipping}</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-400">Weight (grams)</label>
                        <input type="number" min="0" value={form.weight} onChange={e => updateField('weight', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">Length (cm)</label>
                        <input type="number" min="0" value={form.length} onChange={e => updateField('length', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">Width (cm)</label>
                        <input type="number" min="0" value={form.width} onChange={e => updateField('width', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">Height (cm)</label>
                        <input type="number" min="0" value={form.height} onChange={e => updateField('height', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-gray-500">Status</h2>
                <div className="flex gap-2">
                    {(['draft', 'active', 'archived'] as const).map(s => (
                        <button key={s} onClick={() => updateField('status', s)}
                            className={cn('flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors capitalize',
                                form.status === s
                                    ? s === 'active' ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                                        : s === 'archived' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* SEO */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-gray-500">SEO</h2>
                <div>
                    <label className="text-xs font-medium text-gray-400">Meta Title</label>
                    <input value={form.seoTitle} onChange={e => updateField('seoTitle', e.target.value)}
                        maxLength={60}
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    <p className="mt-1 text-[10px] text-gray-600">{form.seoTitle.length}/60</p>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400">Meta Description</label>
                    <textarea value={form.seoDescription} onChange={e => updateField('seoDescription', e.target.value)}
                        rows={2} maxLength={155}
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 resize-none" />
                    <p className="mt-1 text-[10px] text-gray-600">{form.seoDescription.length}/155</p>
                </div>
            </div>
        </div>
    )
}
