'use client'

import { useFormContext } from 'react-hook-form'
import { AlertTriangle } from 'lucide-react'
import { ProductFormValues } from './schema'
import { CategorySelect, Category } from '../CategorySelect'
import { ImageUploader } from '../ImageUploader'
import { useI18n } from '@/i18n'
import { Input } from '@/components/ui/input'

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
        <div className="rounded-2xl border border-solid border-slate-200 dark:border-white/[0.15] bg-white dark:bg-[hsl(var(--card))] p-[25px] flex flex-col gap-6">
            <h2 className="text-[18px] font-semibold text-foreground leading-[1.56] font-outfit m-0">{t.dashboard.products.form.sections?.general || 'General Information'}</h2>
            
            {/* Product Name */}
            <div className="flex flex-col gap-2">
                <label className="text-[14px] font-medium text-foreground flex items-center gap-1 leading-[1.43]">
                    {t.dashboard.products.form.sections?.productName || 'Product Name *'}
                </label>
                <Input
                    {...register('name', {
                        onChange: (e) => {
                            if (!isEdit) {
                                setValue('urlSlug', generateSlug(e.target.value), { shouldDirty: true, shouldValidate: true });
                            }
                        }
                    })}
                    placeholder={t.dashboard.products.form.sections?.productNamePlaceholder || 'Enter product name'}
                />
                {errors.name && (
                    <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-2" id="categoryIds">
                <label
                    id="product-category-label"
                    htmlFor="product-category-select"
                    className="text-[14px] font-semibold text-foreground leading-[1.43]"
                >
                    {t.dashboard.products.form.sections?.category || 'Category'} <span className="text-foreground">*</span>
                </label>
                <CategorySelect
                    categories={categories}
                    triggerId="product-category-select"
                    ariaLabelledBy="product-category-label"
                    errorId="product-category-error"
                    selectedIds={categoryIds || []}
                    onChange={(ids) => setValue('categoryIds', ids, { shouldDirty: true, shouldValidate: true })}
                    error={errors.categoryIds?.message}
                />
            </div>

            {/* Images */}
            <div className="flex flex-col gap-2" id="images">
                <label className="text-[14px] font-medium text-foreground leading-[1.43]">
                    {t.dashboard.products.form.sections?.images || 'Images (Up to 5 images, each < 5MB)'}
                </label>
                <ImageUploader
                    value={images || []}
                    onChange={(newImages) => setValue('images', newImages, { shouldDirty: true, shouldValidate: true })}
                    maxImages={5}
                    maxSizeMB={5}
                    showAltInput={true}
                />
                {(images?.length ?? 0) > 5 && (
                    <p className="text-xs text-muted-foreground">{t.dashboard.products.form.sections.imagesLegacyHint}</p>
                )}
                {errors.images && (
                    <p className="text-xs text-destructive mt-1">{errors.images.message}</p>
                )}
                {/* Advisory hint (GH-1458): non-blocking — Save/Draft always succeeds regardless. */}
                {(images || []).some((img) => !img.alt?.trim()) && (
                    <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--warning))] mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {t.dashboard.products.form.sections?.imagesAltHint || 'Adding Alt text improves SEO and buyer reachability.'}
                    </p>
                )}
            </div>
        </div>
    )
}
