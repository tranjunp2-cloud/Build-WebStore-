'use client'

import { useFormContext } from 'react-hook-form'
import { ProductFormValues } from './schema'
import { CategorySelect, Category } from '../CategorySelect'
import { ImageUploader } from '../ImageUploader'

interface Props {
    categories: Category[]
}

export function GeneralInfoSection({ categories }: Props) {
    const { register, watch, setValue, formState: { errors } } = useFormContext<ProductFormValues>()
    
    const categoryIds = watch('categoryIds')
    const images = watch('images')

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#1E293B]/60 p-[25px] flex flex-col gap-6">
            <h2 className="text-[18px] font-semibold text-[#F8FAFC] leading-[1.56] font-outfit m-0">General Information</h2>
            
            {/* Product Name */}
            <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#F8FAFC] flex items-center gap-1 leading-[1.43]">
                    Product Name *
                </label>
                <input
                    {...register('name')}
                    placeholder="Enter product name"
                    className="w-full rounded-2xl border border-white/[0.08] bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:border-white focus:ring-1 focus:ring-white focus:outline-none transition-colors"
                />
                {errors.name && (
                    <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
                )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43]">
                    Category
                </label>
                <CategorySelect 
                    categories={categories}
                    selectedIds={categoryIds || []}
                    onChange={(ids) => setValue('categoryIds', ids, { shouldDirty: true })}
                    error={errors.categoryIds?.message}
                />
            </div>

            {/* Images */}
            <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-[#F8FAFC] leading-[1.43]">
                    Images (Up to 5 images, each &lt; 5MB)
                </label>
                <ImageUploader 
                    value={images || []}
                    onChange={(newImages) => setValue('images', newImages, { shouldDirty: true })}
                    maxImages={5}
                    maxSizeMB={5}
                />
            </div>
        </div>
    )
}
