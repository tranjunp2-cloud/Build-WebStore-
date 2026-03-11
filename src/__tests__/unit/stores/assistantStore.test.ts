import { describe, it, expect, beforeEach } from 'vitest'
import { useAssistantStore } from '@/store/assistantStore'

describe('assistantStore', () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        useAssistantStore.setState({ isOpen: false })
    })

    it('should have initial state isOpen = false', () => {
        const state = useAssistantStore.getState()
        expect(state.isOpen).toBe(false)
    })

    it('should toggle isOpen from false to true', () => {
        const { toggle } = useAssistantStore.getState()
        toggle()
        expect(useAssistantStore.getState().isOpen).toBe(true)
    })

    it('should toggle isOpen from true to false', () => {
        useAssistantStore.setState({ isOpen: true })
        const { toggle } = useAssistantStore.getState()
        toggle()
        expect(useAssistantStore.getState().isOpen).toBe(false)
    })

    it('should open the panel', () => {
        const { open } = useAssistantStore.getState()
        open()
        expect(useAssistantStore.getState().isOpen).toBe(true)
    })

    it('should close the panel', () => {
        useAssistantStore.setState({ isOpen: true })
        const { close } = useAssistantStore.getState()
        close()
        expect(useAssistantStore.getState().isOpen).toBe(false)
    })

    it('should be idempotent for open() when already open', () => {
        useAssistantStore.setState({ isOpen: true })
        const { open } = useAssistantStore.getState()
        open()
        expect(useAssistantStore.getState().isOpen).toBe(true)
    })

    it('should be idempotent for close() when already closed', () => {
        const { close } = useAssistantStore.getState()
        close()
        expect(useAssistantStore.getState().isOpen).toBe(false)
    })
})
