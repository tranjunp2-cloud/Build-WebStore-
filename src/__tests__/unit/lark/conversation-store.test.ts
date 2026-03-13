import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    addUserMessage,
    addAssistantMessage,
    getConversationMessages,
    clearConversation,
    getActiveConversationCount,
    cleanupExpired,
} from '@/lib/lark/conversation-store'

// Mock the constants to use shorter TTL for testing
vi.mock('@/lib/lark/constants', () => ({
    CONVERSATION_TTL: 1000, // 1 second for tests
    CONVERSATION_MAX_MESSAGES: 5,
}))

describe('Conversation Store', () => {
    const chatId = 'oc_test_chat'
    const openId = 'ou_test_user'

    beforeEach(() => {
        clearConversation(chatId, openId)
    })

    describe('addUserMessage / addAssistantMessage', () => {
        it('should store and retrieve messages', () => {
            addUserMessage(chatId, openId, 'Hello bot')
            addAssistantMessage(chatId, openId, 'Hi there!')

            const messages = getConversationMessages(chatId, openId)
            expect(messages).toHaveLength(2)
            expect(messages[0]).toEqual({ role: 'user', content: 'Hello bot' })
            expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' })
        })

        it('should maintain message order', () => {
            addUserMessage(chatId, openId, 'First')
            addAssistantMessage(chatId, openId, 'Reply 1')
            addUserMessage(chatId, openId, 'Second')
            addAssistantMessage(chatId, openId, 'Reply 2')

            const messages = getConversationMessages(chatId, openId)
            expect(messages).toHaveLength(4)
            expect(messages[0].content).toBe('First')
            expect(messages[3].content).toBe('Reply 2')
        })
    })

    describe('max messages limit', () => {
        it('should trim old messages when exceeding max', () => {
            // Max is 5 in our mock
            for (let i = 0; i < 7; i++) {
                addUserMessage(chatId, openId, `Message ${i}`)
            }

            const messages = getConversationMessages(chatId, openId)
            expect(messages.length).toBeLessThanOrEqual(5)
            // Should keep the latest messages
            expect(messages[messages.length - 1].content).toBe('Message 6')
        })
    })

    describe('TTL expiry', () => {
        it('should return empty for expired conversations', async () => {
            addUserMessage(chatId, openId, 'Old message')

            // Wait for TTL to expire (1 second in mock)
            await new Promise((resolve) => setTimeout(resolve, 1100))

            const messages = getConversationMessages(chatId, openId)
            expect(messages).toHaveLength(0)
        })
    })

    describe('clearConversation', () => {
        it('should clear all messages for a user', () => {
            addUserMessage(chatId, openId, 'Hello')
            addAssistantMessage(chatId, openId, 'Hi')

            clearConversation(chatId, openId)
            const messages = getConversationMessages(chatId, openId)
            expect(messages).toHaveLength(0)
        })
    })

    describe('isolation between users', () => {
        it('should keep separate contexts for different users', () => {
            const user1 = 'ou_user_1'
            const user2 = 'ou_user_2'

            addUserMessage(chatId, user1, 'User 1 message')
            addUserMessage(chatId, user2, 'User 2 message')

            const msgs1 = getConversationMessages(chatId, user1)
            const msgs2 = getConversationMessages(chatId, user2)

            expect(msgs1).toHaveLength(1)
            expect(msgs1[0].content).toBe('User 1 message')
            expect(msgs2).toHaveLength(1)
            expect(msgs2[0].content).toBe('User 2 message')

            // Cleanup
            clearConversation(chatId, user1)
            clearConversation(chatId, user2)
        })
    })

    describe('cleanupExpired', () => {
        it('should remove expired entries', async () => {
            addUserMessage(chatId, openId, 'Will expire')

            // Wait for expiry
            await new Promise((resolve) => setTimeout(resolve, 1100))

            const cleaned = cleanupExpired()
            expect(cleaned).toBeGreaterThanOrEqual(1)
        })
    })
})
