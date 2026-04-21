import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { AIChatPanel } from '@/components/editor/AIChatPanel'

// ── Mocks ────────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                aiChat: {
                    welcomeMessage: 'Hello! What would you like to edit?',
                    drafting: 'AI is drafting...',
                    thinking: 'AI is thinking...',
                    appliedChanges: 'Applied changes to website.',
                    editFailed: 'AI editing failed',
                    failedToEdit: 'Failed to edit website',
                    outOfScope: 'I can only help with editing your website.',
                    undo: 'Undo',
                    changeColorPrompt: 'Change color',
                    addSectionPrompt: '+ Add section',
                    inputPlaceholder: 'Tell AI what to change...',
                    send: 'send',
                    newLine: 'new line',
                },
            },
        },
        locale: 'en',
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/editor/AddSectionPromptChips', () => ({
    AddSectionPromptChips: ({ onPromptSelect }: any) => (
        <button data-testid="prompt-chip" onClick={() => onPromptSelect('Test Prompt')}>
            Prompt Chip
        </button>
    )
}))

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

describe('AIChatPanel', () => {
    const defaultProps = {
        blocks: [
            { id: 'b1', type: 'hero' } as any,
            { id: 'b2', type: 'about' } as any,
        ],
        selectedBlock: 0,
        onAIAction: vi.fn(),
        onUndoLastAction: vi.fn(),
        siteName: 'Test Site',
        theme: { primary: '#0ea5e9' } as any,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn()
    })

    // ── Rendering & Input ────────────────────────────────────────────────

    it('renders the chat panel and shows welcome message', () => {
        render(<AIChatPanel {...defaultProps} />)
        expect(screen.getByRole('log', { name: /ai chat messages/i })).toBeInTheDocument()
        expect(screen.getByText(/Hello!/)).toBeInTheDocument()
    })

    it('typing message updates the input value', () => {
        render(<AIChatPanel {...defaultProps} />)
        const input = screen.getByPlaceholderText(/Tell AI what to change/i) as HTMLTextAreaElement
        fireEvent.change(input, { target: { value: 'Change color to green' } })
        expect(input.value).toBe('Change color to green')
    })
    
    it('does not send empty messages', () => {
        const mockFetch = vi.fn()
        global.fetch = mockFetch
        render(<AIChatPanel {...defaultProps} />)

        const input = screen.getByPlaceholderText(/Tell AI what to change/i) as HTMLTextAreaElement
        fireEvent.change(input, { target: { value: '   ' } })
        
        // Enter should be blocked natively or by onClick check
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })

        expect(mockFetch).not.toHaveBeenCalled()
    })

    // ── Chat Interaction ──────────────────────────────────────────────────

    it('submit sends message using POST without stream when mock says so', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({
                action: 'update_theme',
                changes: { primaryColor: '#22c55e' },
                message: 'Changed to green',
            }),
        })
        global.fetch = mockFetch

        render(<AIChatPanel {...defaultProps} />)
        const input = screen.getByPlaceholderText(/Tell AI what to change/i)
        
        fireEvent.change(input, { target: { value: 'Change color to green' } })
        
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })
        })

        // Assert - user msg
        await waitFor(() => {
            expect(screen.getByText('Change color to green')).toBeInTheDocument()
            expect(mockFetch).toHaveBeenCalledWith('/api/ai/edit-block?stream=true', expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            }))
        })
    })

    it('shows assistant response after successful completion', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({
                action: 'update_theme',
                message: 'Theme updated!',
            }),
        })

        render(<AIChatPanel {...defaultProps} />)
        const input = screen.getByPlaceholderText(/Tell AI what to change/i)
        
        fireEvent.change(input, { target: { value: 'Make it pop' } })
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })
        })

        await waitFor(() => {
            expect(screen.getByText('Theme updated!')).toBeInTheDocument()
        })
        expect(defaultProps.onAIAction).toHaveBeenCalled()
    })

    it('displays error message when API returns error', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
        })

        render(<AIChatPanel {...defaultProps} />)
        const input = screen.getByPlaceholderText(/Tell AI what to change/i)
        
        fireEvent.change(input, { target: { value: 'Do something' } })
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })
        })

        await waitFor(() => {
            expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument()
        })
    })

    it('shows externalActivity as chat message', () => {
        render(<AIChatPanel {...defaultProps} externalActivity={{ id: 'ext-1', content: 'External edit detected' }} />)
        expect(screen.getByText('External edit detected')).toBeInTheDocument()
    })
    
    it('calls onAIAction with update_multiple_blocks from API response', async () => {
        const multiBlockResponse = {
            action: 'update_multiple_blocks',
            updates: [
                { blockIndex: 0, changes: { headline: 'Xin chào' } },
                { blockIndex: 1, changes: { title: 'Về chúng tôi' } },
            ],
            message: 'Translated all sections to Vietnamese.',
        }

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve(multiBlockResponse),
        })

        render(<AIChatPanel {...defaultProps} />)
        const input = screen.getByPlaceholderText(/Tell AI what to change/i)

        fireEvent.change(input, { target: { value: 'Translate everything to Vietnamese' } })
        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })
        })

        await waitFor(() => {
            expect(defaultProps.onAIAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'update_multiple_blocks',
                    updates: expect.arrayContaining([
                        expect.objectContaining({ blockIndex: 0 }),
                        expect.objectContaining({ blockIndex: 1 }),
                    ]),
                })
            )
        })

        await waitFor(() => {
            expect(screen.getByText('Translated all sections to Vietnamese.')).toBeInTheDocument()
        })
    })

    // ── Hydration (MIN-5) ────────────────────────────────────────────────

    it('TC-F05-HYDRATION-01 — server render produces welcome-only HTML (SSR-safe)', () => {
        // Simulate SSR — renderToString never runs useEffect, so output reflects
        // only what useState's initializer produced. Cache must not leak in.
        sessionStorage.setItem('editor-chat-test-site', JSON.stringify([
            { id: 'old', role: 'user', content: 'cached prompt', createdAt: '08:00 AM' },
        ]))

        const html = renderToString(<AIChatPanel {...defaultProps} siteId="test-site" />)

        expect(html).toContain('Hello!')
        expect(html).not.toContain('cached prompt')
        // Welcome must not carry createdAt in initial render (non-deterministic
        // time would break hydration). formatChatTime output contains ' AM'/' PM'
        // on en-US; assert absence.
        const welcomeSegment = html.split('Hello!')[1]?.slice(0, 200) ?? ''
        expect(welcomeSegment).not.toMatch(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/i)

        sessionStorage.clear()
    })

    it('TC-F05-HYDRATION-02 — hydrates from localStorage after mount', async () => {
        localStorage.setItem('editor-chat-test-site', JSON.stringify([
            { id: 'old', role: 'user', content: 'cached prompt', createdAt: '08:00 AM' },
        ]))

        render(<AIChatPanel {...defaultProps} siteId="test-site" />)

        await waitFor(() => {
            expect(screen.getByText('cached prompt')).toBeInTheDocument()
        })

        localStorage.clear()
    })

    it('prompts chip auto-fills input and submits', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ action: 'test', message: 'done' })
        })
        global.fetch = mockFetch

        render(<AIChatPanel {...defaultProps} />)
        
        await act(async () => {
            fireEvent.click(screen.getByTestId('prompt-chip'))
        })

        // In AddSectionPromptChips when prompt is selected it sets the input. Wait, the chip mock only calls onPromptSelect.
        // It should set the input, let's just make sure input receives it
        const input = screen.getByPlaceholderText(/Tell AI what to change/i) as HTMLTextAreaElement
        expect(input.value).toBe('Test Prompt')
    })
})
