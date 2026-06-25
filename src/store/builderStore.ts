/**
 * Builder Store (Zustand)
 * Manages AI Chat Builder state: messages, blocks, theme, generation status.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
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
    language?: string
    businessUrl?: string
    source?: 'form' | 'url'
    slug?: string
}

type BuilderState = {
    // Session owner — used to detect cross-user localStorage contamination
    userId: string | null

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

    // ContentBrief (from URL/Image extraction — passed to generator for high-fidelity output)
    contentBrief: Record<string, unknown> | null

    // Error
    error: { code: string; message: string; retryable: boolean } | null
}

type BuilderActions = {
    // Business Info
    setBusinessInfo: (info: BusinessInfo) => void
    /** Update businessInfo WITHOUT changing step — for extraction pre-fill */
    setBusinessInfoDraft: (info: Partial<BusinessInfo>) => void
    setContentBrief: (brief: Record<string, unknown> | null) => void
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
    setBlocks: (blocks: any[]) => void

    // Session
    setUserId: (userId: string) => void

    // Error
    setError: (error: BuilderState['error']) => void

    // Draft recovery
    clearDraft: () => void

    // Reset
    reset: () => void
}

const INITIAL_STATE: BuilderState = {
    userId: null,
    businessInfo: null,
    step: 'info',
    status: 'idle',
    messages: [],
    blocks: [],
    theme: null,
    siteId: null,
    siteName: null,
    progress: { step: '', label: '', progress: 0 },
    contentBrief: null,
    error: null,
}

const noopStorage: StateStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
}

function getSafeStorage(): StateStorage {
    if (typeof window === 'undefined' || typeof globalThis.localStorage === 'undefined') {
        return noopStorage
    }

    const storage = globalThis.localStorage as Partial<StateStorage>

    if (
        typeof storage.getItem !== 'function' ||
        typeof storage.setItem !== 'function' ||
        typeof storage.removeItem !== 'function'
    ) {
        return noopStorage
    }

    return storage as StateStorage
}

export const useBuilderStore = create<BuilderState & BuilderActions>()(
    persist(
        (set) => ({
            ...INITIAL_STATE,

            setBusinessInfo: (info) =>
                set({
                    businessInfo: info,
                    step: 'chat',
                    messages: [],
                }),

            setBusinessInfoDraft: (draft) =>
                set((state) => ({
                    businessInfo: { ...state.businessInfo, ...draft } as BusinessInfo,
                })),

            setContentBrief: (brief) => set({ contentBrief: brief }),

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
                    blocks: [...state.blocks, { ...block, _id: block._id || `${block.blockType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
                })),

            setTheme: (theme) => set({ theme }),

            setProgress: (progress) => set({ progress }),

            setSiteId: (siteId) => set({ siteId }),

            setSiteName: (name) => set({ siteName: name }),

            setBlocks: (blocks) => set({ blocks }),

            setUserId: (userId) => set({ userId }),

            setError: (error) => set({ error, status: 'error' }),

            reset: () => set(INITIAL_STATE),

            clearDraft: () => {
                set(INITIAL_STATE)
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('prime-builder-session')
                    localStorage.removeItem('prime-builder-session-meta')
                }
            },
        }),
        {
            name: 'prime-builder-session', // name of the item in localStorage
            storage: createJSONStorage(getSafeStorage),
            // Only persist necessary state, reset streaming status and progress
            partialize: (state) => ({
                userId: state.userId,
                businessInfo: state.businessInfo,
                // streaming cannot survive reload (SSE connection is lost) — reset to form
                step: state.status === 'streaming' ? 'info' : state.step,
                status: (state.status === 'error' || state.status === 'streaming') ? 'idle' : state.status,
                messages: state.status === 'streaming' ? [] : state.messages,
                blocks: state.status === 'streaming' ? [] : state.blocks,
                theme: state.theme,
                siteId: state.siteId,
                siteName: state.siteName,
                progress: state.status === 'streaming' ? { step: '', label: '', progress: 0 } : state.progress,
                // Never persist error — it may contain sensitive server details
                error: null,
            }),
            // Defensive fallback for stale localStorage that still has streaming state
            onRehydrateStorage: () => (state) => {
                if (state?.error) {
                    state.error = null
                    state.status = state.status === 'error' ? 'idle' : state.status
                }
                // SSE connection was lost on reload — streaming state cannot be resumed
                if (state?.status === 'streaming') {
                    state.status = 'idle'
                    state.step = 'info'
                    state.blocks = []
                    state.messages = []
                    state.progress = { step: '', label: '', progress: 0 }
                }
            },
        }
    )
)

/** Check draft validity without triggering store circular ref */
export function getDraftStatus(): 'valid' | 'expired' | 'corrupted' | 'wrong-user' | 'none' {
    const state = useBuilderStore.getState()
    if (!state.businessInfo) return 'none'
    const metaRaw = typeof window !== 'undefined' ? localStorage.getItem('prime-builder-session-meta') : null
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw) as { lastTouchedAt?: number; userId?: string }
            if (meta.userId && state.userId && meta.userId !== state.userId) return 'wrong-user'
            if (meta.lastTouchedAt && Date.now() - meta.lastTouchedAt > 24 * 60 * 60 * 1000) return 'expired'
        } catch (err) {
            if (process.env.NODE_ENV === 'development') console.error('[BuilderDraft] parse meta failed', err)
            return 'corrupted'
        }
    }
    return 'valid'
}

/** Get draft display metadata without triggering store circular ref */
export function getDraftMeta(): { siteName: string; industry: string; status: string; savedAt: number } {
    const state = useBuilderStore.getState()
    const metaRaw = typeof window !== 'undefined' ? localStorage.getItem('prime-builder-session-meta') : null
    let savedAt = Date.now()
    if (metaRaw) {
        try {
            savedAt = (JSON.parse(metaRaw) as { lastTouchedAt?: number }).lastTouchedAt || savedAt
        } catch (err) {
            if (process.env.NODE_ENV === 'development') console.error('[BuilderDraft] parse meta failed', err)
        }
    }
    return {
        siteName: state.businessInfo?.businessName || '',
        industry: state.businessInfo?.industry || '',
        status: state.step || 'info',
        savedAt,
    }
}
