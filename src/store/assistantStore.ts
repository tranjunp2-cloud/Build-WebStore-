import { create } from 'zustand'

interface AssistantState {
    /** Whether the assistant panel is open */
    isOpen: boolean
    /** Toggle panel open/close */
    toggle: () => void
    /** Open the panel */
    open: () => void
    /** Close the panel */
    close: () => void
}

export const useAssistantStore = create<AssistantState>((set) => ({
    isOpen: false,
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}))
