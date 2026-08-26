// TC-F08-05-40: Parent Category options follow the category hierarchy preorder (GH-1687)
import { describe, expect, it } from 'vitest'
import {
    flattenCategoryHierarchy,
    type Category,
} from '@/app/(dashboard)/products/categories/components/CategoryManager'

describe('TC-F08-05-40: Parent Category hierarchy ordering', () => {
    it('TC-F08-05-40: flattens a shuffled hierarchy in parent-first preorder', () => {
        // Arrange
        const categories: Category[] = [
            { id: 'root-b', name: 'Beauty', parent: null },
            { id: 3, name: 'Shirts', parent: 'child-a' },
            { id: 'child-b', name: 'Women', parent: 1 },
            { id: 'child-a', name: 'Men', parent: { id: 1, name: 'Apparel' } },
            { id: 1, name: 'Apparel', parent: null },
        ]

        // Act
        const result = flattenCategoryHierarchy(categories)

        // Assert
        expect(result.map(category => category.id)).toEqual([
            1,
            'child-a',
            3,
            'child-b',
            'root-b',
        ])
        expect(result.map(category => category.level)).toEqual([1, 2, 3, 2, 1])
    })

    it('TC-F08-05-40: sorts siblings by name and uses the ID as a stable tie-breaker', () => {
        // Arrange
        const categories: Category[] = [
            { id: 'root', name: 'Root', parent: null },
            { id: 'child-20', name: 'Same', parent: 'root' },
            { id: 'child-z', name: 'Zulu', parent: 'root' },
            { id: 'child-10', name: 'Same', parent: { id: 'root', name: 'Root' } },
            { id: 'child-a', name: 'Alpha', parent: 'root' },
        ]

        // Act
        const result = flattenCategoryHierarchy(categories)

        // Assert
        expect(result.map(category => category.id)).toEqual([
            'root',
            'child-a',
            'child-10',
            'child-20',
            'child-z',
        ])
    })
})
