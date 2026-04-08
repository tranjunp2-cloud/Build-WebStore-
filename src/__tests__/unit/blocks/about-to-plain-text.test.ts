import { describe, it, expect } from 'vitest'

// Re-implement toPlainText here since it's not exported (inline helper in component)
// Must stay in sync with src/blocks/about/index.tsx
function toPlainText(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') {
        if (value.startsWith('{')) {
            try { return toPlainText(JSON.parse(value)) } catch { return value }
        }
        return value
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>
        if (obj.text && typeof obj.text === 'string') return obj.text
        if (Array.isArray(obj.children)) return (obj.children as unknown[]).map(toPlainText).join('')
        if (obj.root) return toPlainText(obj.root)
    }
    return String(value)
}

describe('[TC-F01-about] toPlainText richText parser', () => {
    it('TC-F01-about-01: returns empty string for null/undefined', () => {
        expect(toPlainText(null)).toBe('')
        expect(toPlainText(undefined)).toBe('')
        expect(toPlainText('')).toBe('')
    })

    it('TC-F01-about-02: returns plain string as-is', () => {
        expect(toPlainText('Hello world')).toBe('Hello world')
    })

    it('TC-F01-about-03: extracts text from richText JSON string', () => {
        const json = '{"root":{"children":[{"type":"paragraph","children":[{"text":"About us content"}]}]}}'
        expect(toPlainText(json)).toBe('About us content')
    })

    it('TC-F01-about-04: extracts text from richText object', () => {
        const obj = {
            root: {
                children: [
                    { type: 'paragraph', children: [{ text: 'About us content' }] },
                ],
            },
        }
        expect(toPlainText(obj)).toBe('About us content')
    })

    it('TC-F01-about-05: returns string for invalid JSON', () => {
        expect(toPlainText('{not valid json')).toBe('{not valid json')
    })

    it('TC-F01-about-06: handles multiple paragraphs', () => {
        const obj = {
            root: {
                children: [
                    { type: 'paragraph', children: [{ text: 'First. ' }] },
                    { type: 'paragraph', children: [{ text: 'Second.' }] },
                ],
            },
        }
        expect(toPlainText(obj)).toBe('First. Second.')
    })
})
