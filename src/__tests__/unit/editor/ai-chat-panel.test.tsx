import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getBlockMeta: (type: string) => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            icon: '🧩',
            variants: ['default'],
            type,
        }),
        getAllMeta: () => [
            { type: 'hero', name: 'Hero', icon: '🦸', variants: ['default'] },
            { type: 'about', name: 'About', icon: '📄', variants: ['default'] },
        ],
    },
}))

// Must import AFTER mocks are set up
import { AIChatPanel } from '@/components/editor/AIChatPanel'

const defaultProps = {
    isOpen: true,
    onToggle: vi.fn(),
    blocks: [
        { blockType: 'hero', heading: 'Welcome', variant: 'default' },
        { blockType: 'about', body: 'About us', variant: 'default' },
    ],
    onBlockSelect: vi.fn(),
    selectedBlock: 0,
    onAIAction: vi.fn(),
    siteName: 'Test Site',
    theme: { primaryColor: '#0ea5e9', fontHeading: 'Outfit', fontBody: 'Inter' },
}

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

describe('AIChatPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn()
    })

    // ── Rendering ────────────────────────────────────────────────────────

    it('renders the panel with tabs when open', () => {
        // Arrange & Act
        render(<AIChatPanel {...defaultProps} />)

        // Assert
        expect(screen.getByRole('tab', { name: /blocks/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /ai chat/i })).toBeInTheDocument()
    })

    it('renders collapsed toggle button when closed', () => {
        // Arrange & Act
        render(<AIChatPanel {...defaultProps} isOpen={false} />)

        // Assert
        expect(screen.getByLabelText('Open editor panel')).toBeInTheDocument()
    })

    it('renders block list in blocks tab', () => {
        // Arrange & Act
        render(<AIChatPanel {...defaultProps} />)

        // Assert — blocks tab is default
        expect(screen.getByText('2 blocks')).toBeInTheDocument()
        expect(screen.getByText('Hero')).toBeInTheDocument()
        expect(screen.getByText('About')).toBeInTheDocument()
    })

    // ── Chat tab interaction ─────────────────────────────────────────────

    it('switches to chat tab and shows welcome message', () => {
        // Arrange
        render(<AIChatPanel {...defaultProps} />)

        // Act
        fireEvent.click(screen.getByRole('tab', { name: /ai chat/i }))

        // Assert
        expect(screen.getByRole('log', { name: /ai chat messages/i })).toBeInTheDocument()
        expect(screen.getByText(/I can help you edit your website/)).toBeInTheDocument()
    })

    it('typing message updates the input value', () => {
        // Arrange
        render(<AIChatPanel {...defaultProps} />)
        fireEvent.click(screen.getByRole('tab', { name: /ai chat/i }))

        // Act
        const input = screen.getByPlaceholderText(/ask ai to make changes/i) as HTMLInputElement
        fireEvent.change(input, { target: { value: 'Change color to green' } })

        // Assert
        expect(input.value).toBe('Change color to green')
    })

    it('submit sends message and shows user message in chat', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                action: 'update_theme',
                changes: { primaryColor: '#22c55e' },
                message: 'Changed to green',
            }),
        })
        global.fetch = mockFetch

        render(<AIChatPanel {...defaultProps} />)
        fireEvent.click(screen.getByRole('tab', { name: /ai chat/i }))

        // Act
        const input = screen.getByPlaceholderText(/ask ai to make changes/i)
        fireEvent.change(input, { target: { value: 'Change color to green' } })
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Send message'))
        })

        // Assert — user message appears
        await waitFor(() => {
            expect(screen.getByText('Change color to green')).toBeInTheDocument()
        })

        // Assert — API called with correct payload
        expect(mockFetch).toHaveBeenCalledWith('/api/ai/edit-block', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        }))
    })

    it('shows assistant response after successful AI action', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                action: 'update_theme',
                changes: { primaryColor: '#22c55e' },
                message: 'Changed to green',
            }),
        })

        render(<AIChatPanel {...defaultProps} />)
        fireEvent.click(screen.getByRole('tab', { name: /ai chat/i }))

        // Act
        const input = screen.getByPlaceholderText(/ask ai to make changes/i)
        fireEvent.change(input, { target: { value: 'Change color to green' } })
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Send message'))
        })

        // Assert
        await waitFor(() => {
            expect(screen.getByText(/Theme updated/)).toBeInTheDocument()
        })
        expect(defaultProps.onAIAction).toHaveBeenCalledWith(expect.objectContaining({
            action: 'update_theme',
        }))
    })

    it('displays error message when API returns error', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
        })

        render(<AIChatPanel {...defaultProps} />)
        fireEvent.click(screen.getByRole('tab', { name: /ai chat/i }))

        // Act
        const input = screen.getByPlaceholderText(/ask ai to make changes/i)
        fireEvent.change(input, { target: { value: 'Do something' } })
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Send message'))
        })

        // Assert
        await waitFor(() => {
            expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument()
        })
    })

    it('displays error message when fetch throws', async () => {
        // Arrange
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

        render(<AIChatPanel {...defaultProps} />)
        fireEvent.click(screen.getByRole('tab', { name: /ai chat/i }))

        // Act
        const input = screen.getByPlaceholderText(/ask ai to make changes/i)
        fireEvent.change(input, { target: { value: 'Do something' } })
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Send message'))
        })

        // Assert
        await waitFor(() => {
            expect(screen.getByText(/Network error/)).toBeInTheDocument()
        })
    })

    it('does not send empty messages', () => {
        // Arrange
        const mockFetch = vi.fn()
        global.fetch = mockFetch

        render(<AIChatPanel {...defaultProps} />)
        fireEvent.click(screen.getByRole('tab', { name: /ai chat/i }))

        // Act — click send without typing
        fireEvent.click(screen.getByLabelText('Send message'))

        // Assert
        expect(mockFetch).not.toHaveBeenCalled()
    })

    // ── Block selection ──────────────────────────────────────────────────

    it('clicking a block calls onBlockSelect', () => {
        // Arrange
        render(<AIChatPanel {...defaultProps} />)

        // Act
        fireEvent.click(screen.getByText('About'))

        // Assert
        expect(defaultProps.onBlockSelect).toHaveBeenCalledWith(1)
    })

    it('selected block is highlighted with aria-current', () => {
        // Arrange & Act
        render(<AIChatPanel {...defaultProps} selectedBlock={0} />)

        // Assert
        const buttons = screen.getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'true')
        expect(buttons).toHaveLength(1)
    })

    // ── Toggle ───────────────────────────────────────────────────────────

    it('close button calls onToggle', () => {
        // Arrange
        render(<AIChatPanel {...defaultProps} />)

        // Act
        fireEvent.click(screen.getByLabelText('Close editor panel'))

        // Assert
        expect(defaultProps.onToggle).toHaveBeenCalledOnce()
    })
})
