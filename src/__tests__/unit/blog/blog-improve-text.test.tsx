import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React, { useState } from 'react'

// Spec-equivalent wrapper — CKEditor not available in vitest, so we test the
// Improve Text state machine in isolation (same pattern as blog-rich-editor.test.tsx)
function ImproveTextMenu({ initialShow = true, initialText = 'Hello world' }: { initialShow?: boolean; initialText?: string }) {
    const [showImproveMenu, setShowImproveMenu] = useState(initialShow)
    const [selectedText] = useState(initialText)
    const [isRewriting, setIsRewriting] = useState(false)

    const handleImproveText = async (instruction: string) => {
        if (!selectedText.trim()) return
        setIsRewriting(true)
        setShowImproveMenu(false)
        try {
            await fetch('/api/ai/rewrite-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: selectedText, instruction }),
            })
        } catch { /* ignore */ } finally {
            setIsRewriting(false)
        }
    }

    return (
        <div>
            {showImproveMenu && selectedText && (
                <div data-testid="improve-menu">
                    <span>AI Improve</span>
                    {[
                        { label: 'Make Professional', instruction: 'Rewrite this text to sound more professional and polished' },
                        { label: 'Make Shorter', instruction: 'Make this text shorter and more concise while keeping the meaning' },
                        { label: 'Improve Writing', instruction: 'Improve the grammar, clarity, and readability of this text' },
                    ].map((action) => (
                        <button key={action.label} onClick={() => handleImproveText(action.instruction)}>
                            {action.label}
                        </button>
                    ))}
                    <button onClick={() => setShowImproveMenu(false)}>Cancel</button>
                </div>
            )}
            {isRewriting && <div data-testid="rewriting-overlay">Rewriting...</div>}
        </div>
    )
}

describe('[TC-F17-03-03] Improve Text — Menu & Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ rewritten: 'Improved text' }))))
    })

    it('[TC-12] renders 3 action buttons when menu is visible', () => {
        render(<ImproveTextMenu />)
        expect(screen.getByTestId('improve-menu')).toBeDefined()
        expect(screen.getByText('Make Professional')).toBeDefined()
        expect(screen.getByText('Make Shorter')).toBeDefined()
        expect(screen.getByText('Improve Writing')).toBeDefined()
        expect(screen.getByText('AI Improve')).toBeDefined()
    })

    it('[TC-12b] menu not visible when initialShow=false', () => {
        render(<ImproveTextMenu initialShow={false} />)
        expect(screen.queryByTestId('improve-menu')).toBeNull()
    })

    it('[TC-13] shows rewriting overlay during API call', async () => {
        let resolveFetch: (v: Response) => void
        global.fetch = vi.fn(() => new Promise<Response>(resolve => { resolveFetch = resolve }))
        render(<ImproveTextMenu />)
        fireEvent.click(screen.getByText('Make Professional'))
        await waitFor(() => expect(screen.getByTestId('rewriting-overlay')).toBeDefined())
        // Resolve fetch so setState runs before teardown
        resolveFetch!(new Response(JSON.stringify({ rewritten: 'ok' })))
        await waitFor(() => expect(screen.queryByTestId('rewriting-overlay')).toBeNull())
    })

    it('[TC-14] calls /api/ai/rewrite-text with correct payload', async () => {
        render(<ImproveTextMenu />)
        fireEvent.click(screen.getByText('Make Shorter'))
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/ai/rewrite-text', expect.objectContaining({
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ text: 'Hello world', instruction: 'Make this text shorter and more concise while keeping the meaning' }),
            }))
        })
    })

    it('[TC-15] cancel button hides menu without API call', () => {
        render(<ImproveTextMenu />)
        fireEvent.click(screen.getByText('Cancel'))
        expect(screen.queryByTestId('improve-menu')).toBeNull()
        expect(global.fetch).not.toHaveBeenCalled()
    })
})
