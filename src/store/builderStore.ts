/**
 * Builder Store (Zustand)
 * Manages AI Chat Builder state: messages, blocks, theme, generation status.
 */

import { create } from 'zustand'
import type { ThemeConfig } from '@/blocks/types'

// ── Types ────────────────────────────────────────────────────────────────

export type Message = {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

export type BuilderStatus = 'idle' | 'streaming' | 'done' | 'error'

export type ProgressStep = {
    step: string
    label: string
    progress: number
}

export type BusinessInfo = {
    businessName: string
    shortDescription: string
    industry: string
    products: string
    targetAudience: string
    style: string
}

type BuilderState = {
    // Business Info (Step 1)
    businessInfo: BusinessInfo | null
    step: 'info' | 'chat' | 'done'

    // Chat
    status: BuilderStatus
    messages: Message[]

    // Generation
    blocks: any[]
    theme: ThemeConfig | null
    siteId: string | null
    siteName: string | null
    progress: ProgressStep

    // Error
    error: { code: string; message: string; retryable: boolean } | null
}

type BuilderActions = {
    // Business Info
    setBusinessInfo: (info: BusinessInfo) => void
    setStep: (step: BuilderState['step']) => void

    // Chat
    addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void
    setStatus: (status: BuilderStatus) => void

    // Generation
    addBlock: (block: any) => void
    setTheme: (theme: ThemeConfig) => void
    setProgress: (progress: ProgressStep) => void
    setSiteId: (siteId: string) => void
    setSiteName: (name: string) => void

    // Error
    setError: (error: BuilderState['error']) => void

    // Reset
    reset: () => void
}

const INITIAL_STATE: BuilderState = {
    businessInfo: null,
    step: 'info',
    status: 'idle',
    messages: [],
    blocks: [],
    theme: null,
    siteId: null,
    siteName: null,
    progress: { step: '', label: '', progress: 0 },
    error: null,
}

export const useBuilderStore = create<BuilderState & BuilderActions>((set) => ({
    ...INITIAL_STATE,

    setBusinessInfo: (info) =>
        set({
            businessInfo: info,
            step: 'chat',
            messages: [],
        }),

    setStep: (step) => set({ step }),

    addMessage: (msg) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        set((state) => ({
            messages: [
                ...state.messages,
                { ...msg, id, timestamp: new Date() },
            ],
        }))
    },

    setStatus: (status) => set({ status }),

    addBlock: (block) =>
        set((state) => ({
            blocks: [...state.blocks, block],
        })),

    setTheme: (theme) => set({ theme }),

    setProgress: (progress) => set({ progress }),

    setSiteId: (siteId) => set({ siteId }),

    setSiteName: (name) => set({ siteName: name }),

    setError: (error) => set({ error, status: 'error' }),

    reset: () => set(INITIAL_STATE),
}))

