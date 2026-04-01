'use client'

import { useFormContext } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { CategorySelect, Category } from '../CategorySelect'
import { ImageUploader } from '../ImageUploader'
import { useI18n } from '@/i18n'

const generateSlug = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD') // Remove diacritics
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

interface Props {
    categories: Category[]
    isEdit?: boolean
}

export function GeneralInfoSection({ categories, isEdit }: Props) {
    const { register, watch, setValue, formState: { errors } } = useFormContext<ProductFormValues>()
    const { t } = useI18n()
    
    const categoryIds = watch('categoryIds')
    const images = watch('images')

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#1E293B]/60 p-[25px] flex flex-col gap-6">
            <h2 className="text-[18px] font-semibold text-[#F8FAFC] leading-[1.56] font-outfit m-0">{t.dashboard.products.form.sections?.general || 'General Information'}</h2>
            
            {/* Product Name */}
            <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#F8FAFC] flex items-center gap-1 leading-[1.43]">
                    {t.dashboard.products.form.sections?.productName || 'Product Name *'}
                </label>
                <input
                    {...register('name', {
                        onChange: (e) => {
                            if (!isEdit) {
                                setValue('urlSlug', generateSlug(e.target.value), { shouldDirty: true, shouldValidate: true });
                            }
                        }
                    })}
                    placeholder={t.dashboard.products.form.sections?.productNamePlaceholder || 'Enter product name'}
                    className="w-full rounded-2xl border border-white/[0.08] bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:border-white focus:ring-1 focus:ring-white focus:outline-none transition-colors"
                />
                {errors.name && (
                    <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
                )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-2" id="categoryIds">
                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43]">
                    {t.dashboard.products.form.sections?.category || 'Category'}
                </label>
                <CategorySelect 
                    categories={categories}
                    selectedIds={categoryIds || []}
                    onChange={(ids) => setValue('categoryIds', ids, { shouldDirty: true, shouldValidate: true })}
                    error={errors.categoryIds?.message}
                />
                {errors.categoryIds && (
                    <p className="text-xs text-red-500 mt-1">{errors.categoryIds.message}</p>
                )}
            </div>

            {/* Images */}
            <div className="flex flex-col gap-2" id="images">
                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43]">
                    {t.dashboard.products.form.sections?.images || 'Images (Up to 5 images, each < 5MB)'}
                </label>
                <ImageUploader 
                    value={images || []}
                    onChange={(newImages) => setValue('images', newImages, { shouldDirty: true, shouldValidate: true })}
                    maxImages={5}
                    maxSizeMB={5}
                />
                {errors.images && (
                    <p className="text-xs text-red-500 mt-1">{errors.images.message}</p>
                )}
            </div>
        </div>
    )
}
