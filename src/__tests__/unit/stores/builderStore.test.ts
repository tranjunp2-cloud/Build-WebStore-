import { describe, it, expect, beforeEach } from 'vitest'
import { useBuilderStore } from '@/store/builderStore'

const mockBusinessInfo = {
    businessName: 'Bella Bakery',
    shortDescription: 'A friendly neighborhood bakery since 2010',
    industry: 'Food & Beverage',
    products: 'Cakes, Cookies, Bread',
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

        it('should clear messages when setting business info', () => {
            useBuilderStore.getState().setBusinessInfo(mockBusinessInfo)
            expect(useBuilderStore.getState().messages).toHaveLength(0)
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

    describe('generation metadata', () => {
        it('should store progress, theme, site id and site name', () => {
            useBuilderStore.getState().setProgress({
                step: 'generate',
                label: 'Generating layout',
                progress: 55,
            })
            useBuilderStore.getState().setTheme({
                primaryColor: '#111827',
                secondaryColor: '#f59e0b',
                fontHeading: 'Inter',
                fontBody: 'Inter',
                colorMode: 'light',
            })
            useBuilderStore.getState().setSiteId('site-123')
            useBuilderStore.getState().setSiteName('Bella Bakery')

            const state = useBuilderStore.getState()
            expect(state.progress).toEqual({
                step: 'generate',
                label: 'Generating layout',
                progress: 55,
            })
            expect(state.theme?.primaryColor).toBe('#111827')
            expect(state.siteId).toBe('site-123')
            expect(state.siteName).toBe('Bella Bakery')
        })

        it('should replace the current blocks list when setBlocks is called', () => {
            useBuilderStore.getState().addBlock({ blockType: 'hero', heading: 'Welcome' })
            useBuilderStore.getState().setBlocks([
                { _id: 'features-1', blockType: 'features' },
                { _id: 'contact-1', blockType: 'contact' },
            ])

            expect(useBuilderStore.getState().blocks).toEqual([
                { _id: 'features-1', blockType: 'features' },
                { _id: 'contact-1', blockType: 'contact' },
            ])
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

        it('should clear the error when null is provided while keeping error status behavior explicit', () => {
            useBuilderStore.getState().setError({
                code: 'AI_TIMEOUT',
                message: 'Generation failed',
                retryable: true,
            })
            useBuilderStore.getState().setError(null)

            const state = useBuilderStore.getState()
            expect(state.error).toBeNull()
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
