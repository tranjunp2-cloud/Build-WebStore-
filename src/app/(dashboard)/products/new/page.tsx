'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProductForm } from '@/components/dashboard/product-form/ProductForm'
import { ProductFormValues } from '@/components/dashboard/product-form/schema'
import { useI18n } from '@/i18n'
import { saveProductAction } from '../actions'

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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

export default function NewProductPage() {
    const router = useRouter()
    const { t } = useI18n()

    const handleSave = async (data: ProductFormValues) => {
        const body = {
            name: data.name,
            slug: data.urlSlug || slugify(data.name),
            description: data.description ? textToLexical(data.description) : undefined,
            price: data.hasVariants ? 0 : data.basePrice || 0,
            compareAtPrice: data.hasVariants ? undefined : data.compareAtPrice || undefined,
            category: data.categoryIds,
            inventory: data.hasVariants ? (data.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0) : (data.baseInventory || 0),
            sku: data.hasVariants ? '' : data.baseSku || '',
            weight: data.shippingWeight || 0,
            dimensions: {
                length: data.shippingLength || 0,
                width: data.shippingWidth || 0,
                height: data.shippingHeight || 0,
            },
            images: data.images?.map(img => ({ image: img.id, alt: data.name })) || [],
            hasVariants: data.hasVariants,
            variantConfigs: data.hasVariants ? data.tiers?.map((t) => ({
                name: t.name,
                options: t.options.map((opt) => ({ value: opt }))
            })) || [] : [],
            variants: data.hasVariants ? data.variants?.map((v) => ({
                name: v.variantName,          // Payload schema field: 'name'
                sku: v.skuCode,               // Payload schema field: 'sku'
                price: v.price,
                compareAtPrice: v.compareAtPrice,
                stock: v.stock,
            })) || [] : [],
            seo: {
                title: data.metaTitle,
                description: data.metaDescription,
            },
            attributes: (data.attributes || [])
                .filter((a) => a.key?.trim() && a.value?.trim())
                .map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
            status: 'draft',
            currency: 'MYR'
        }

        try {
            await saveProductAction(body)
            toast.success(t.dashboard.products.form.draftSaved)
            setTimeout(() => {
                router.push('/products')
            }, 1500)
        } catch (err: any) {
            throw new Error(err?.message || t.dashboard.products.form.somethingWentWrong)
        }
    }

    return (
        <div className="w-full">
            <ProductForm onSubmitForm={handleSave} />
        </div>
    )
}
