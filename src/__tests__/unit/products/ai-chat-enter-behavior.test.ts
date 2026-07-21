// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { getAiChatEnterBehavior } from '@/lib/products/ai-chat-enter-behavior'

describe('getAiChatEnterBehavior', () => {
    it('submits on plain Enter when the prompt has content', () => {
        expect(getAiChatEnterBehavior({ key: 'Enter', prompt: 'Create two products' })).toBe('submit')
    })

    it('blocks plain Enter from adding a blank newline when the prompt is empty', () => {
        expect(getAiChatEnterBehavior({ key: 'Enter', prompt: '   ' })).toBe('block')
    })

    it('ignores Shift+Enter so multiline input still works', () => {
        expect(getAiChatEnterBehavior({ key: 'Enter', prompt: 'Line 1', shiftKey: true })).toBe('ignore')
    })

    it('ignores Enter while IME composition is active', () => {
        expect(getAiChatEnterBehavior({ key: 'Enter', prompt: 'Fermented chili paste', isComposing: true })).toBe('ignore')
    })
})
