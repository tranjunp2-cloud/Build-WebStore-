/**
 * GH-2378 — plain-text summary of a product (quick view, meta description, JSON-LD).
 * Real: productSummaryText / descriptionPlainText, renderBlogContent (Lexical → HTML + DOMPurify). Nothing mocked.
 */
import { describe, expect, it } from 'vitest'
import { descriptionPlainText, productSummaryText } from '@/lib/products/product-summary-text'

const lexical = (...paragraphs: string[]) => ({
    root: {
        type: 'root', format: '', indent: 0, version: 1,
        children: paragraphs.map((text) => ({
            type: 'paragraph', format: '', indent: 0, version: 1,
            children: text ? [{ type: 'text', text, mode: 'normal', style: '', detail: 0, format: 0, version: 1 }] : [],
        })),
    },
})

describe('[GH-2378] product summary text', () => {
    it('[TC-F09-2378-01] Lexical paragraphs become plain text with a space between paragraphs', () => {
        // Arrange
        const description = lexical('First line.', 'Second line.')

        // Act
        const text = descriptionPlainText(description)

        // Assert
        expect(text).toBe('First line. Second line.')
    })

    it('[TC-F09-2378-02] PW1 HTML in a text node: no tags, no script content, entities decoded', () => {
        // Arrange
        const description = lexical('<p>Tom &amp; Jerry <strong>golf</strong> tee</p><script>alert(1)</script><img src=x onerror="alert(2)"><ul><li>Cotton</li><li>Soft</li></ul>')

        // Act
        const text = descriptionPlainText(description)

        // Assert
        expect(text).toBe('Tom & Jerry golf tee Cotton Soft')
        expect(text).not.toMatch(/[<>]|alert|onerror/)
    })

    it('[TC-F09-2378-02] Word-style HTML: <style> CSS dropped, table cells spaced, quoted ">" in attributes kept out', () => {
        // Arrange
        const description = lexical('<p>A</p><style>.x{color:red}</style><table><tr><td>Size</td><td>M</td></tr></table><a title="a>b" href="/x">link</a>')

        // Act
        const text = descriptionPlainText(description)

        // Assert
        expect(text).toBe('A Size M link')
    })

    it('[TC-F09-2378-02] plain string descriptions work and invalid input gives an empty string', () => {
        // Arrange / Act / Assert
        expect(descriptionPlainText('Soft   cotton.\n\nBreathable.')).toBe('Soft cotton. Breathable.')
        expect(descriptionPlainText(null)).toBe('')
        expect(descriptionPlainText({ root: 'broken' })).toBe('')
    })

    it('[TC-F09-2378-03] long description is cut at a word boundary with an ellipsis within maxLength', () => {
        // Arrange
        const description = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda'

        // Act
        const text = productSummaryText({ description }, 30)

        // Assert
        expect(text.length).toBeLessThanOrEqual(30)
        expect(text).toBe('alpha beta gamma delta…')
        expect(description.startsWith(text.slice(0, -1))).toBe(true)
    })

    it('[TC-F09-2378-03] one very long word is hard cut within maxLength', () => {
        // Arrange / Act
        const text = productSummaryText({ description: 'x'.repeat(500) }, 50)

        // Assert
        expect(text).toHaveLength(50)
        expect(text.endsWith('…')).toBe(true)
    })

    it('[TC-F09-2378-03] hard cut never leaves half an emoji', () => {
        // Arrange
        const description = '\u{1F455}'.repeat(100)

        // Act
        const text = productSummaryText({ description }, 50)

        // Assert
        expect(text.length).toBeLessThanOrEqual(50)
        expect(text).not.toMatch(/[\uD800-\uDBFF]…$/)
        expect(text.endsWith('\u{1F455}…')).toBe(true)
    })

    it('[TC-F09-2378-03] shortDescription is returned trimmed and untruncated; empty inputs give an empty string', () => {
        // Arrange
        const short = `  ${'word '.repeat(100).trim()}  `

        // Act / Assert
        expect(productSummaryText({ shortDescription: short, description: lexical('ignored') })).toBe(short.trim())
        expect(productSummaryText({ shortDescription: '  ', description: lexical('Used') })).toBe('Used')
        expect(productSummaryText({ shortDescription: '', description: lexical('') })).toBe('')
        expect(productSummaryText({})).toBe('')
    })
})
