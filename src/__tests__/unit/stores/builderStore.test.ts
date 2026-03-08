import { describe, it, expect, beforeEach } from 'vitest'
import { useBuilderStore } from '@/store/builderStore'

const mockBusinessInfo = {
    businessName: 'Bella Bakery',
    industry: 'Food & Beverage',
    products: 'Cakes, Cookies, Bread',
    targetAudience: 'Young professionals',
    style: 'Modern, clean',
}

describe('BuilderStore', () => {
    beforeEach(() => {
        useBuilderStore.getState().reset()
    })

    describe('initial state', () => {
        it('should start with idle status', () => {
            expect(useBuilderStore.getState().status).toBe('idle')
            expect(useBuilderStore.getState().step).toBe('info')
            expect(useBuilderStore.getState().messages).toHaveLength(0)
            expect(useBuilderStore.getState().blocks).toHaveLength(0)
        })
    })

    describe('setBusinessInfo', () => {
        it('should store business info and advance to chat step', () => {
            useBuilderStore.getState().setBusinessInfo(mockBusinessInfo)
            const state = useBuilderStore.getState()
            expect(state.businessInfo).toEqual(mockBusinessInfo)
            expect(state.step).toBe('chat')
        })

        it('should add welcome message with business name', () => {
            useBuilderStore.getState().setBusinessInfo(mockBusinessInfo)
            const messages = useBuilderStore.getState().messages
            expect(messages).toHaveLength(1)
            expect(messages[0].role).toBe('assistant')
            expect(messages[0].content).toContain('Bella Bakery')
        })
    })

    describe('addMessage', () => {
        it('should add message with auto-generated id and timestamp', () => {
            useBuilderStore.getState().addMessage({
                role: 'user',
                content: 'Create now',
            })
            const messages = useBuilderStore.getState().messages
            expect(messages).toHaveLength(1)
            expect(messages[0].role).toBe('user')
            expect(messages[0].content).toBe('Create now')
            expect(messages[0].id).toBeDefined()
            expect(messages[0].timestamp).toBeInstanceOf(Date)
        })
    })

    describe('setStatus', () => {
        it('should update generation status', () => {
            useBuilderStore.getState().setStatus('streaming')
            expect(useBuilderStore.getState().status).toBe('streaming')
        })
    })

    describe('addBlock', () => {
        it('should add blocks to the list', () => {
            useBuilderStore.getState().addBlock({ blockType: 'hero', heading: 'Welcome' })
            useBuilderStore.getState().addBlock({ blockType: 'about', content: 'About us' })
            expect(useBuilderStore.getState().blocks).toHaveLength(2)
        })
    })

    describe('setError', () => {
        it('should set error and change status to error', () => {
            useBuilderStore.getState().setError({
                code: 'AI_TIMEOUT',
                message: 'Generation failed',
                retryable: true,
            })
            const state = useBuilderStore.getState()
            expect(state.error?.code).toBe('AI_TIMEOUT')
            expect(state.status).toBe('error')
        })
    })

    describe('reset', () => {
        it('should reset to initial state', () => {
            useBuilderStore.getState().setBusinessInfo(mockBusinessInfo)
            useBuilderStore.getState().addBlock({ blockType: 'hero' })
            useBuilderStore.getState().setStatus('done')
            useBuilderStore.getState().reset()

            const state = useBuilderStore.getState()
            expect(state.step).toBe('info')
            expect(state.status).toBe('idle')
            expect(state.messages).toHaveLength(0)
            expect(state.blocks).toHaveLength(0)
            expect(state.businessInfo).toBeNull()
        })
    })
})
