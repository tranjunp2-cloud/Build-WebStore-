'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProductForm } from '@/components/dashboard/product-form/ProductForm'
import { ProductFormValues } from '@/components/dashboard/product-form/schema'

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

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function ProductEditPage() {
    const params = useParams()
    const router = useRouter()
    const productId = params?.id as string
    const isNew = productId === 'new'

    const [initialData, setInitialData] = useState<Partial<ProductFormValues> | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)

    useEffect(() => {
        if (isNew) {
            setInitialData({})
            setIsLoading(false)
            return
        }
        
        async function loadProduct() {
            try {
                const res = await fetch(`/api/products/${productId}`, { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    const mappedData: Partial<ProductFormValues> = {
                        name: data.name || '',
                        urlSlug: data.slug || '',
                        description: lexicalToText(data.description) || '',
                        categoryIds: Array.isArray(data.category) 
                            ? data.category.map((c: any) => typeof c === 'string' ? c : c.id) 
                            : [],
                        images: data.images?.map((img: any) => ({
                            id: typeof img.image === 'string' ? img.image : img.image?.id,
                            url: typeof img.image === 'string' ? '' : (img.image?.url || ''),
                        })).filter((i: any) => i.id) || [],
                        
                        hasVariants: Boolean(data.hasVariants),
                        
                        basePrice: data.price ? parseFloat(data.price) : undefined,
                        compareAtPrice: data.compareAtPrice ? parseFloat(data.compareAtPrice) : undefined,
                        baseInventory: data.inventory ? parseInt(data.inventory) : undefined,
                        baseSku: data.sku || '',
                        
                        tiers: data.variantConfigs || [],
                        variants: (data.variants || []).map((v: any, index: number) => ({
                            id: v.id || v.skuCode || `var-${index}`,
                            variantName: v.options ? v.options.join(' / ') : '',
                            skuCode: v.skuCode || '',
                            price: v.price ? parseFloat(v.price) : 0,
                            discount: v.compareAtPrice ? parseFloat(v.compareAtPrice) : undefined,
                            stock: v.stock !== undefined ? parseInt(v.stock) : 0,
                        })),

                        shippingWeight: data.weight ? parseFloat(data.weight) : undefined,
                        shippingLength: data.dimensions?.length ? parseFloat(data.dimensions.length) : undefined,
                        shippingWidth: data.dimensions?.width ? parseFloat(data.dimensions.width) : undefined,
                        shippingHeight: data.dimensions?.height ? parseFloat(data.dimensions.height) : undefined,

                        metaTitle: data.seo?.title || '',
                        autoGenerateSeo: false, // UI default
                    }
                    setInitialData(mappedData)
                } else {
                    toast.error('Failed to load product')
                }
            } catch (err) {
                toast.error('Failed to load product')
            } finally {
                setIsLoading(false)
            }
        }
        loadProduct()
    }, [productId, isNew])

    const handleSave = async (data: ProductFormValues) => {
        try {
            const body = {
                name: data.name,
                slug: data.urlSlug || slugify(data.name),
                description: data.description ? textToLexical(data.description) : undefined,
                price: data.hasVariants ? 0 : data.basePrice || 0,
                compareAtPrice: data.hasVariants ? undefined : data.compareAtPrice || undefined,
                category: data.categoryIds,
                inventory: data.hasVariants ? 0 : data.baseInventory || 0,
                sku: data.hasVariants ? '' : data.baseSku || '',
                weight: data.shippingWeight || 0,
                dimensions: {
                    length: data.shippingLength || 0,
                    width: data.shippingWidth || 0,
                    height: data.shippingHeight || 0,
                },
                images: data.images.map(img => ({ image: img.id, alt: data.name })),
                hasVariants: data.hasVariants,
                variantConfigs: data.hasVariants ? data.tiers : [],
                variants: data.hasVariants ? data.variants?.map(v => ({
                    name: v.variantName,          // Payload schema field: 'name'
                    sku: v.skuCode,               // Payload schema field: 'sku'
                    price: v.price,
                    compareAtPrice: v.discount,
                    stock: v.stock,
                    options: v.variantName.split(' - ')
                })) : [],
                seo: {
                    title: data.metaTitle,
                    description: data.metaDescription,
                },
                status: 'draft', // Standard
                currency: 'MYR'
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
                toast.success(isNew ? 'Product created successfully' : 'Product updated successfully')
                setTimeout(() => {
                    router.push('/products')
                }, 1500)
            } else {
                const errData = await res.json()
                throw new Error(errData.error?.message || 'Failed to save')
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Network error'
            toast.error(message)
            throw err; // throw to let ProductForm know it failed (so it stops isSaving state if it had one)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                toast.success('Product deleted successfully');
                router.push('/products');
            } else {
                toast.error('Failed to delete product');
            }
        } catch (err) {
            toast.error('Network error');
        }
    }

    if (isLoading) {
        return (
            <div className="mx-auto max-w-3xl space-y-6 animate-pulse p-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/5" />
                    <div className="h-7 w-48 rounded bg-white/5" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 h-64" />
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 h-48" />
            </div>
        )
    }

    return (
        <div className="w-full">
            <ProductForm 
                isEdit={!isNew} 
                initialData={initialData || undefined} 
                onSubmitForm={handleSave} 
            />
        </div>
    )
}
