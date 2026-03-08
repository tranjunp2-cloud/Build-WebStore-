'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Save, Sparkles, Loader2, Package,
    Plus, Trash2, Upload as UploadIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ProductForm = {
    name: string
    slug: string
    shortDescription: string
    price: string
    compareAtPrice: string
    currency: string
    category: string
    status: 'draft' | 'active' | 'archived'
    inventory: string
    sku: string
    seoTitle: string
    seoDescription: string
}

const initialForm: ProductForm = {
    name: '',
    slug: '',
    shortDescription: '',
    price: '',
    compareAtPrice: '',
    currency: 'MYR',
    category: '',
    status: 'draft',
    inventory: '0',
    sku: '',
    seoTitle: '',
    seoDescription: '',
}

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function ProductEditPage() {
    const params = useParams()
    const router = useRouter()
    const productId = params?.id as string
    const isNew = productId === 'new'

    const [form, setForm] = useState<ProductForm>(initialForm)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedDescription, setGeneratedDescription] = useState('')
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
                        price: String(data.price || ''),
                        compareAtPrice: String(data.compareAtPrice || ''),
                        currency: data.currency || 'MYR',
                        category: data.category || '',
                        status: data.status || 'draft',
                        inventory: String(data.inventory || 0),
                        sku: data.sku || '',
                        seoTitle: data.seo?.title || '',
                        seoDescription: data.seo?.description || '',
                    })
                }
            } catch (err) {
                setError('Failed to load product')
            } finally {
                setIsLoading(false)
            }
        }
        loadProduct()
    }, [productId, isNew])

    const updateField = (field: keyof ProductForm, value: string) => {
        setForm(prev => {
            const updated = { ...prev, [field]: value }
            // Auto-generate slug from name
            if (field === 'name' && (isNew || !prev.slug)) {
                updated.slug = slugify(value)
            }
            return updated
        })
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            setError('Product name is required')
            return
        }
        if (!form.price || parseFloat(form.price) < 0) {
            setError('Valid price is required')
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            const body = {
                name: form.name,
                slug: form.slug || slugify(form.name),
                shortDescription: form.shortDescription,
                price: parseFloat(form.price),
                compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : undefined,
                currency: form.currency,
                category: form.category,
                status: form.status,
                inventory: parseInt(form.inventory) || 0,
                sku: form.sku,
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
                setTimeout(() => {
                    router.push('/dashboard/products')
                }, 1000)
            } else {
                const data = await res.json()
                setError(data.error?.message || 'Failed to save')
            }
        } catch (err: any) {
            setError(err.message || 'Network error')
        } finally {
            setIsSaving(false)
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
                    setGeneratedDescription(data.data.description || '')
                    setForm(prev => ({
                        ...prev,
                        shortDescription: data.data.shortDescription || prev.shortDescription,
                        seoTitle: data.data.seoTitle || prev.seoTitle,
                        seoDescription: data.data.seoDescription || prev.seoDescription,
                    }))
                }
            }
        } catch (err) {
            setError('AI generation failed')
        } finally {
            setIsGenerating(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/products"
                        className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="text-2xl font-bold text-white">
                        {isNew ? 'New Product' : `Edit: ${form.name}`}
                    </h1>
                </div>
                <button onClick={handleSave} disabled={isSaving || success}
                    className={cn('flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors shadow-lg',
                        success ? 'bg-green-600 shadow-green-500/25' : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-500')}>
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                        : success ? <><Package className="h-4 w-4" /> Saved!</>
                            : <><Save className="h-4 w-4" /> Save Product</>}
                </button>
            </div>

            {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* Basic Info */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-gray-500">Basic Information</h2>

                <div>
                    <label className="text-xs font-medium text-gray-400">Product Name *</label>
                    <input value={form.name} onChange={e => updateField('name', e.target.value)}
                        placeholder="e.g. Premium Nasi Lemak Set"
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-400">Slug</label>
                        <input value={form.slug} onChange={e => updateField('slug', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">Category</label>
                        <input value={form.category} onChange={e => updateField('category', e.target.value)}
                            placeholder="e.g. Food, Electronics"
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50" />
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-400">Short Description</label>
                        <button onClick={handleAIGenerate} disabled={isGenerating || !form.name.trim()}
                            className="flex items-center gap-1 rounded-lg bg-purple-500/10 px-3 py-1 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
                            {isGenerating ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                                : <><Sparkles className="h-3 w-3" /> Generate with AI</>}
                        </button>
                    </div>
                    <textarea value={form.shortDescription} onChange={e => updateField('shortDescription', e.target.value)}
                        rows={2} maxLength={300} placeholder="Brief product description for cards..."
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 resize-none" />
                    <p className="mt-1 text-[10px] text-gray-600">{form.shortDescription.length}/300</p>
                </div>

                {generatedDescription && (
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-4">
                        <p className="text-xs font-medium text-purple-400 mb-2">✨ AI Generated Description</p>
                        <div className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: generatedDescription }} />
                    </div>
                )}
            </div>

            {/* Pricing */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-gray-500">Pricing & Inventory</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-400">Price *</label>
                        <div className="mt-1.5 flex items-center rounded-lg border border-white/10 bg-[#0B1120] overflow-hidden focus-within:border-blue-500/50">
                            <span className="px-3 text-xs text-gray-500 bg-white/5">{form.currency === 'MYR' ? 'RM' : '$'}</span>
                            <input type="number" step="0.01" min="0" value={form.price}
                                onChange={e => updateField('price', e.target.value)}
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none" />
                        </div>
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-400">Inventory</label>
                        <input type="number" min="0" value={form.inventory}
                            onChange={e => updateField('inventory', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-400">SKU</label>
                        <input value={form.sku} onChange={e => updateField('sku', e.target.value)}
                            placeholder="e.g. NL-PREM-001"
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50" />
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
