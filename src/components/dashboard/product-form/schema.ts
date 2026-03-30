  import { z } from 'zod'

export const optionTierSchema = z.object({
    id: z.string(),
    name: z.string().min(1, 'Tier name is required'),
    options: z.array(z.string()).min(1, 'At least one option is required'),
})

export const skuVariantSchema = z.object({
    id: z.string(),
    variantName: z.string(),
    skuCode: z.string().min(1, 'SKU Code is required'),
    price: z.coerce.number().min(0, 'Price must be 0 or greater'),
    discount: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().min(0, 'Stock must be 0 or greater'),
})

export const productFormSchema = z.object({
    name: z.string().min(3, 'Product name must be at least 3 characters').max(120, 'Product name must not exceed 120 characters'),
    categoryIds: z.array(z.union([z.string(), z.number()])).min(1, 'Product must belong to at least one category'),
    images: z.array(z.object({ id: z.union([z.string(), z.number()]), url: z.string() })).max(5, 'Maximum 5 images allowed'),
    
    hasVariants: z.boolean().default(false),
    
    // Non-variant mode
    basePrice: z.coerce.number().min(0, 'Price must be 0 or greater').optional(),
    compareAtPrice: z.coerce.number().min(0, 'Compare at price must be 0 or greater').optional(),
    baseInventory: z.coerce.number().min(0, 'Stock cannot be negative').optional(),
    baseSku: z.string().max(50, 'SKU must not exceed 50 characters').optional(),
    
    // Variant mode
    tiers: z.array(optionTierSchema).optional(),
    variants: z.array(skuVariantSchema).optional(),
    
    // Shipping & Dimensions
    shippingWeight: z.coerce.number().min(0.01, 'Weight must be greater than 0').optional(),
    shippingLength: z.coerce.number().min(0, 'Length must be at least 0').optional(),
    shippingHeight: z.coerce.number().min(0, 'Height must be at least 0').optional(),
    shippingWidth: z.coerce.number().min(0, 'Width must be at least 0').optional(),
    
    // Description & SEO
    description: z.string().optional(),
    autoGenerateSeo: z.boolean().default(false),
    metaTitle: z.string().max(70, 'SEO Title should not exceed 70 characters').optional(),
    metaDescription: z.string().max(160, 'SEO description should not exceed 160 characters').optional(),
    urlSlug: z.string().optional(),
}).refine((data) => {
    if (!data.hasVariants) {
        if (data.compareAtPrice !== undefined && data.basePrice !== undefined) {
            return data.compareAtPrice > data.basePrice;
        }
    }
    return true;
}, {
    message: 'Compare at price must be strictly GREATER than base price',
    path: ['compareAtPrice']
})

export type ProductFormValues = z.infer<typeof productFormSchema>
