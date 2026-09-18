import { validations, type ArrayFieldValidation } from 'payload'
import { isMigrationContext } from '../migration/pw1-json/runtime'
import { allowsProductImages, MAX_PRODUCT_IMAGES } from './image-limit'

const mediaIds = (rows: unknown): unknown[] => Array.isArray(rows)
    ? rows.map(row => row !== null && typeof row === 'object' && 'image' in row ? row.image : undefined)
    : []

export const validateProductImages: ArrayFieldValidation = (value, options) => {
    const historicalEdit = options.operation === 'update' && Array.isArray(value)
        && allowsProductImages(mediaIds(value), mediaIds(options.previousValue))
    // Only the private importer capability bypasses the creation limit. A JSON
    // context flag or a caller-supplied previous gallery cannot authorize this.
    const preserve = isMigrationContext(options.req.context) || historicalEdit
    return validations.array(value, { ...options, maxRows: preserve ? undefined : MAX_PRODUCT_IMAGES })
}
