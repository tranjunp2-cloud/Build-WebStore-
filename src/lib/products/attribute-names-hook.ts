import { ValidationError, type CollectionBeforeValidateHook } from 'payload'
import { isMigrationContext } from '../migration/pw1-json/runtime'
import { attributesChanged, DUPLICATE_ATTRIBUTE_MESSAGE, findDuplicateAttributeIndexes } from './attribute-names'

/** Server-side twin of the form rule: block duplicate attribute names, but only when the list is edited. */
export const validateUniqueAttributeNames: CollectionBeforeValidateHook = ({ data, originalDoc, operation, context }) => {
    if (isMigrationContext(context)) return data
    const attributes = data?.attributes
    if (!Array.isArray(attributes)) return data
    if (operation === 'update' && !attributesChanged(attributes, originalDoc?.attributes)) return data
    const duplicates = findDuplicateAttributeIndexes(attributes)
    if (duplicates.length > 0) {
        throw new ValidationError({
            collection: 'products',
            errors: duplicates.map(index => ({ path: `attributes.${index}.key`, message: DUPLICATE_ATTRIBUTE_MESSAGE })),
        })
    }
    return data
}
