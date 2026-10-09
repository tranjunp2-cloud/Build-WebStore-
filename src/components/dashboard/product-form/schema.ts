import { z } from 'zod'
import { allowsProductImages } from '@/lib/products/image-limit'

type ProductFormI18n = { dashboard?: { products?: { form?: { errors?: Record<string, string> } } } };

export const getProductFormSchema = (t: ProductFormI18n, previousImages: readonly { id: string | number }[] = []) => {
    const errorT = t?.dashboard?.products?.form?.errors || {};

    const skuVariantSchema = z.object({
        id: z.string(),
        variantName: z.string(),
        skuCode: z.string().trim().min(1, errorT.skuRequired || 'SKU Code is required').max(100, errorT.skuLong || 'SKU Code is too long'),
        price: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number({ required_error: errorT.priceMin || 'Price is required', invalid_type_error: errorT.priceMin || 'Price is required' }).min(0, errorT.priceMin || 'Price must be 0 or greater').max(100000000, errorT.priceMax || 'Price is too large')),
        compareAtPrice: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0, errorT.priceMin || 'Compare price must be 0 or greater').max(100000000, errorT.priceMax || 'Price is too large').optional()),
        stock: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number({ required_error: errorT.stockMin || 'Stock is required', invalid_type_error: errorT.stockMin || 'Stock is required' }).min(0, errorT.stockMin || 'Stock must be 0 or greater').max(1000000, errorT.stockMax || 'Stock is too large')),
    }).refine((data) => {
        if (data.compareAtPrice !== undefined && data.compareAtPrice > 0 && data.price !== undefined) {
            return data.compareAtPrice > data.price;
        }
        return true;
    }, {
        message: errorT.comparePriceInvalid || 'Compare at price must be strictly GREATER than base price',
        path: ['compareAtPrice']
    });

    return z.object({
        name: z.string().trim().min(3, errorT.nameMin || 'Product name must be at least 3 characters').max(120, errorT.nameMax || 'Product name must not exceed 120 characters'),
        categoryIds: z.array(z.union([z.string(), z.number()])).min(1, errorT.categoryRequired || 'Product must belong to at least one category'),
        images: z.array(z.object({ id: z.union([z.string(), z.number()]), url: z.string(), alt: z.string().optional() })).refine(images => allowsProductImages(images.map(image => image.id), previousImages.map(image => image.id)), errorT.imagesMax || 'Maximum 5 images allowed'),
        
        hasVariants: z.boolean().default(false),
        
        // Non-variant mode
        basePrice: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0, errorT.priceMin || 'Price must be 0 or greater').max(100000000, errorT.priceMax || 'Price is too large').optional()),
        compareAtPrice: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0, errorT.priceMin || 'Compare at price must be 0 or greater').max(100000000, errorT.priceMax || 'Price is too large').optional()),
        baseInventory: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0, errorT.stockMin || 'Stock cannot be negative').max(1000000, errorT.stockMax || 'Stock is too large').optional()),
        baseSku: z.string().trim().max(50, errorT.skuLong || 'SKU must not exceed 50 characters').optional(),
        
        // Variant mode
        tiers: z.array(z.object({
            id: z.string(),
            name: z.string().trim().max(50, errorT.tierNameLong || 'Option name is too long'),
            options: z.array(z.string().trim().max(50, errorT.optionLong || 'Option is too long'))
                .max(30, errorT.optionMax || 'Maximum 30 options per tier'),
        }))
        .max(2, errorT.maxTiers || 'Maximum 2 tiers allowed')
        .superRefine((tiers, ctx) => {
            tiers.forEach((tier, i) => {
                const isEmpty = !tier.name?.trim() && (tier.options || []).every(o => !o?.trim());
                if (isEmpty) return;

                if (!tier.name?.trim()) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.tierNameRequired || 'Option name is required', path: [i, 'name'] });
                }

                const validOpts = (tier.options || []).filter(o => o?.trim());
                if (validOpts.length === 0) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.optionMin || 'At least one option is required', path: [i, 'options'] });
                } else {
                    (tier.options || []).forEach((opt, oIdx) => {
                        if (!opt?.trim()) {
                            ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.optionEmpty || 'Option cannot be empty', path: [i, 'options', oIdx] });
                        }
                    });
                }

                if (new Set(validOpts.map(o => o.toLowerCase())).size !== validOpts.length) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.uniqueOptions || 'Options must be unique (no duplicates)', path: [i, 'options'] });
                }
            });

            const nonEmptyNames = tiers.filter(t => t.name?.trim()).map(t => t.name.trim().toLowerCase());
            if (new Set(nonEmptyNames).size !== nonEmptyNames.length) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.uniqueTiers || 'Option names must be unique', path: [] });
            }
        })
        .optional(),
        variants: z.array(skuVariantSchema)
            .max(900, errorT.maxVariants || 'Too many variants')
            .superRefine((variants, ctx) => {
                if (!variants) return;
                const skuCounts = new Map<string, number>();
                variants.forEach((v) => {
                    const sku = v.skuCode.trim().toLowerCase();
                    if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
                });

                variants.forEach((v, index) => {
                    const sku = v.skuCode.trim().toLowerCase();
                    if (sku && (skuCounts.get(sku) || 0) > 1) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: errorT.uniqueSku || 'SKU Codes must be unique across all variants',
                            path: [index, 'skuCode']
                        });
                    }
                });
            })
            .optional(),
        
        // Shipping & Dimensions (Handle empty string as undefined to allow properly optional fields)
        shippingWeight: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0.01, errorT.weightMin || 'Weight must be greater than 0').max(1000, errorT.weightMax || 'Weight is too large').optional()),
        shippingLength: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0, errorT.dimMin || 'Length must be at least 0').max(10000, errorT.dimMax || 'Length is too large').optional()),
        shippingHeight: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0, errorT.dimMin || 'Height must be at least 0').max(10000, errorT.dimMax || 'Height is too large').optional()),
        shippingWidth: z.preprocess((v) => v === '' ? undefined : v, z.coerce.number().min(0, errorT.dimMin || 'Width must be at least 0').max(10000, errorT.dimMax || 'Width is too large').optional()),
        
        // Description & SEO
        description: z.string().optional(),
        autoGenerateSeo: z.boolean().default(false),
        metaTitle: z.string().max(70, errorT.seoTitleMax || 'SEO Title should not exceed 70 characters').optional(),
        metaDescription: z.string().max(160, errorT.seoDescMax || 'SEO description should not exceed 160 characters').optional(),
        urlSlug: z.string().trim().min(1, errorT.urlSlugRequired || 'URL Slug is required').regex(/^[a-z0-9-]+$/, errorT.urlSlugInvalid || 'Slug must be lowercase alphanumeric with hyphens'),

        currency: z.string().optional().default('MYR'),

        // Attributes (key/value pairs, max 20)
        attributes: z.array(z.object({
            key: z.string().trim().min(1, errorT.attrKeyRequired || 'Attribute name is required').max(100, errorT.attrKeyLong || 'Attribute name is too long'),
            value: z.string().trim().min(1, errorT.attrValueRequired || 'Attribute value is required').max(500, errorT.attrValueLong || 'Attribute value is too long'),
        })).max(20, errorT.attrMax || 'Maximum 20 attributes allowed').optional(),
    }).superRefine((data, ctx) => {
        // Weight required in BOTH modes — single top-level shipping-calc field, not part of the
        // variant matrix. Mirrors src/lib/products/publish-guard.ts (GH-1458 Active-toggle gate).
        if (data.shippingWeight === undefined || data.shippingWeight === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.weightRequired || 'Weight is required', path: ['shippingWeight'] });
        }

        if (!data.hasVariants) {
            // Non-variant mode: base fields required
            if (data.basePrice === undefined || data.basePrice === null) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.priceMin || 'Price is required', path: ['basePrice'] });
            }
            if (!data.baseSku || data.baseSku.trim() === '') {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.skuRequired || 'SKU Code is required', path: ['baseSku'] });
            }
            if (data.baseInventory === undefined || data.baseInventory === null) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.stockMin || 'Inventory must be provided', path: ['baseInventory'] });
            }
            if (data.compareAtPrice !== undefined && data.compareAtPrice > 0 && data.basePrice !== undefined) {
                if (data.compareAtPrice <= data.basePrice) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.comparePriceInvalid || 'Compare at price must be strictly GREATER than base price', path: ['compareAtPrice'] });
                }
            }
        } else {
            // Variant mode: matrix must be generated
            if (!data.variants || data.variants.length === 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.variantsRequired || 'Please generate the variants matrix before saving', path: ['variants'] });
            }
            // baseSku always required (used as prefix for variant SKU codes)
            if (!data.baseSku || data.baseSku.trim() === '') {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: errorT.skuRequired || 'SKU Code is required', path: ['baseSku'] });
            }
        }
    });
};

export type ProductFormValues = z.infer<ReturnType<typeof getProductFormSchema>>;
