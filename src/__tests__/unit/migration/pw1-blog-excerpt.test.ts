import { expect, it } from 'vitest'
import { blogExcerpt } from '@/lib/blog/excerpt'
it('[TC-F35.M56] extracts imported HTML wrapped in Lexical', () => {
    const content = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ text: '<p>First &amp; second</p><p>Next</p>' }] }] } }
    expect(blogExcerpt(content)).toBe('First & second Next')
})
it('[TC-F35.M56] preserves native paragraphs and limits HTML excerpts', () => {
    const content = { root: { type: 'root', children: [{ children: [{ text: 'One' }] }, { children: [{ text: 'Two' }] }] } }
    expect(blogExcerpt(content)).toBe('One Two')
    expect(blogExcerpt('<p>1234567890</p>', 8)).toBe('12345...')
    expect(blogExcerpt(null)).toBe('')
})
