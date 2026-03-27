'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProductFormValues, productFormSchema } from './schema'
import Link from 'next/link'
import { ChevronLeft, Save, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { GeneralInfoSection } from './GeneralInfoSection'
import { VariantsInventorySection } from './VariantsInventorySection'
import { ShippingDimensionsSection } from './ShippingDimensionsSection'
import { DescriptionSeoSection } from './DescriptionSeoSection'

interface ProductFormProps {
    initialData?: Partial<ProductFormValues>;
    isEdit?: boolean;
    onSubmitForm?: (data: ProductFormValues) => Promise<void>;
}

export function ProductForm({ initialData, isEdit, onSubmitForm }: ProductFormProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

    const methods = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: initialData || {
            name: '',
            categoryIds: [],
            images: [],
            description: '',
            hasVariants: false,
            basePrice: undefined,
            compareAtPrice: undefined,
            baseInventory: undefined,
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
        }
    })

    // Mount logic for hydration and fetch categories
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/categories?limit=100', { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    setCategories(data.docs || [])
                }
            } catch (err) {
                console.error('Failed to fetch categories:', err)
            }
        }
        fetchCategories()
    }, [])

    const onSubmit = async (data: ProductFormValues) => {
        setIsSaving(true)
        try {
            if (onSubmitForm) {
                await onSubmitForm(data);
            } else {
                console.log('Form data:', data)
                toast.success('Product saved as draft')
                // Delay and redirect
                setTimeout(() => {
                    router.push('/products')
                }, 1000)
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }

    if (!mounted) return null;

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="relative flex flex-col w-full">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/products" className="flex shrink-0 items-center justify-center text-[#F8FAFC] hover:text-[#F8FAFC]/80 transition-colors">
                            <ArrowLeft className="h-6 w-6" />
                        </Link>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-[24px] font-bold font-outfit text-[#F8FAFC] leading-[1.33] m-0">
                                {isEdit ? 'Edit Product' : 'Add New Product'}
                            </h1>
                            <p className="text-[14px] text-[#F8FAFC]/60 leading-[1.43] m-0">Fill in complete product information</p>
                        </div>
                    </div>
                </div>

                {/* Form sections */}
                <div className="flex flex-col gap-6 pb-24">
                    <GeneralInfoSection categories={categories} />
                    <VariantsInventorySection />
                    <ShippingDimensionsSection />
                    <DescriptionSeoSection />
                </div>

                {/* Fixed Footer Actions */}
                <div className="fixed bottom-0 left-0 right-0 z-40 md:left-[260px] bg-[#0B1120] border-t border-white/[0.08] px-8 py-[18px]">
                    <div className="flex flex-row items-center gap-3 w-full bg-[#0B1120]">
                        <button
                            type="button"
                            onClick={() => router.push('/products')}
                            className="flex-1 h-12 rounded-2xl border border-white/[0.08] bg-transparent text-[16px] font-medium text-[#F8FAFC] hover:bg-white/5 transition-colors flex items-center justify-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 h-12 rounded-2xl border-none outline-none bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-[16px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-[9px]"
                        >
                            <Save className="w-5 h-5 flex-shrink-0" />
                            <span>{isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save as Draft'}</span>
                        </button>
                    </div>
                </div>
            </form>
        </FormProvider>
    )
}
