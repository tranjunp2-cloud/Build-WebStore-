import { describe, expect, it } from 'vitest'
import { descriptionEditPatch, lexicalToText } from '@/lib/products/description-edit'

describe('[TC-F42-059] Editing other product fields preserves rich description', () => {
  it('omits the description patch for unchanged rich content', () => {
    // Arrange
    const rich = { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello', format: 1, style: 'color:red' }, { type: 'upload', value: 23 }] }] } }
    const initial = lexicalToText(rich)
    // Act
    const patch = descriptionEditPatch(initial, initial, false)
    const saved = { description: rich, ...patch, name: 'Updated product' }
    // Assert
    expect(patch).not.toHaveProperty('description')
    expect(saved.description).toBe(rich)
  })
  it('preserves media-only content when its empty textarea is unchanged', () => {
    // Arrange
    const initial = lexicalToText({ root: { children: [{ type: 'upload', value: 23 }] } })
    // Act
    const patch = descriptionEditPatch('', initial, false)
    // Assert
    expect(patch).not.toHaveProperty('description')
  })
  it('writes changed text and supports explicitly clearing existing text', () => {
    // Arrange
    const initial = 'Original'
    // Act
    const edited = descriptionEditPatch('Changed', initial, false)
    const cleared = descriptionEditPatch('', initial, false)
    // Assert
    expect(lexicalToText(edited.description)).toBe('Changed')
    expect(cleared).toEqual({ description: null })
  })
  it('creates a new description without comparing with existing content', () => {
    // Arrange
    const text = 'New product'
    // Act
    const patch = descriptionEditPatch(text, text, true)
    // Assert
    expect(lexicalToText(patch.description)).toBe(text)
  })
})
