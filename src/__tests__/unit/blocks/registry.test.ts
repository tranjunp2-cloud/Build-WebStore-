import { describe, it, expect } from 'vitest'
import { blockRegistry } from '@/blocks/registry'

describe('blockRegistry', () => {
    describe('getBlockTypes', () => {
        it('should return all registered block types', () => {
            const types = blockRegistry.getBlockTypes()
            expect(types).toContain('hero')
            expect(types).toContain('navigation')
            expect(types).toContain('footer')
            expect(types).toContain('logo-cloud')
            expect(types.length).toBeGreaterThanOrEqual(15)
        })
    })

    describe('count', () => {
        it('should match number of block types', () => {
            expect(blockRegistry.count).toBe(blockRegistry.getBlockTypes().length)
        })
    })

    describe('has', () => {
        it('should return true for registered types', () => {
            expect(blockRegistry.has('hero')).toBe(true)
            expect(blockRegistry.has('navigation')).toBe(true)
            expect(blockRegistry.has('contact')).toBe(true)
        })

        it('should return false for unknown types', () => {
            expect(blockRegistry.has('unknown-block')).toBe(false)
            expect(blockRegistry.has('')).toBe(false)
        })
    })

    describe('getComponent', () => {
        it('should return component for known type', () => {
            const Hero = blockRegistry.getComponent('hero')
            expect(Hero).toBeDefined()
            expect(typeof Hero).toBe('function')
        })

        it('should return null for unknown type', () => {
            expect(blockRegistry.getComponent('unknown')).toBe(null)
        })
    })

    describe('getSchema', () => {
        it('should return Zod schema for known type', () => {
            const schema = blockRegistry.getSchema('hero')
            expect(schema).toBeDefined()
            expect(schema?.safeParse).toBeDefined()
        })

        it('should return null for unknown type', () => {
            expect(blockRegistry.getSchema('unknown')).toBe(null)
        })
    })

    describe('getBlockMeta', () => {
        it('should return meta with type, name, description for known type', () => {
            const meta = blockRegistry.getBlockMeta('hero')
            expect(meta).toBeDefined()
            expect(meta?.type).toBe('hero')
            expect(meta?.name).toBeDefined()
            expect(meta?.description).toBeDefined()
        })

        it('should return null for unknown type', () => {
            expect(blockRegistry.getBlockMeta('unknown')).toBe(null)
        })
    })

    describe('getAllMeta', () => {
        it('should return array of all block metas', () => {
            const metas = blockRegistry.getAllMeta()
            expect(Array.isArray(metas)).toBe(true)
            expect(metas.length).toBe(blockRegistry.count)
            expect(metas.every(m => m && typeof m.type === 'string')).toBe(true)
        })
    })

    describe('validate', () => {
        it('should accept valid hero config', () => {
            const result = blockRegistry.validate('hero', {
                blockType: 'hero',
                headline: 'Welcome',
            })
            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
        })

        it('should reject invalid hero config (missing required)', () => {
            const result = blockRegistry.validate('hero', {
                blockType: 'hero',
                // missing headline
            })
            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })

        it('should reject unknown block type', () => {
            const result = blockRegistry.validate('unknown-type', {})
            expect(result.success).toBe(false)
            expect(result.error).toContain('Unknown block type')
        })

        it('should accept valid about config', () => {
            const result = blockRegistry.validate('about', {
                blockType: 'about',
                headline: 'About us',
                body: 'About us text',
            })
            expect(result.success).toBe(true)
        })
    })
})
