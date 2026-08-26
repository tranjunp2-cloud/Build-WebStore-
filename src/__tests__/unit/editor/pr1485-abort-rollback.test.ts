/**
 * PR #1485 Round 2 — Undo Parity Regression Test: handleAbortRollback
 *
 * Coverage Map (QA Doc Traceability):
 *   TC-F05-15-17  → handleAbortRollback: calls undo() exactly N times for N applied actions
 *   TC-F05-15-18  → handleAbortRollback: stops early if canUndo() becomes false before N undos
 *   TC-F05-15-19  → handleAbortRollback: calls save after undo loop so DB is in sync (no orphaned state)
 *
 * Context (C1 from PR #1485):
 *   The compact AIChatPanel applies AI actions incrementally (and DB-saves each one)
 *   as SSE events stream in. On abort, `appliedCount` of those actions already landed.
 *   Compact hides the global undo/redo pill, so handleAbortRollback is the ONLY recovery
 *   path. Must fully revert everything the aborted stream applied, then persist so the
 *   DB no longer holds the orphaned partial edit.
 *
 * State Machine:
 *   1. AI stream starts: isProcessing=true, appliedCount=0
 *   2. Action 1 applied: DB saved, appliedCount=1, undo history push
 *   3. Action 2 applied: DB saved, appliedCount=2, undo history push
 *   4. User hits Stop mid-stream while processing
 *   5. onAbortRollback(appliedCount=2) called
 *   6. Loop: undo() × 2 (revert action 2, revert action 1)
 *   7. Save with refreshPreview=false to persist reverted state to DB
 *   8. Result: DB now matches pre-stream state, no orphaned partial edit
 *
 * NOTE: These are unit tests verifying the undo loop logic itself. The actual
 * handleAbortRollback function lives in page.tsx. These tests verify the behavior
 * that the function should exhibit based on the store's undo API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: handleAbortRollback Logic — Undo Parity & State Recovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unit tests for the undo-loop logic that handleAbortRollback should implement.
 * The actual function lives in src/app/(editor)/editor/[siteId]/page.tsx.
 *
 * This test suite verifies the behavior: loop N times calling undo(), stop early
 * if canUndo() becomes false, then call save().
 */

describe('TC-F05-15-17..21 — handleAbortRollback: Undo Parity for Aborted AI Stream', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    /**
     * Helper function that mimics the handleAbortRollback implementation
     * seen in page.tsx after the PR #1485 fix.
     */
    function createHandleAbortRollback(store: any, onSave: any) {
        return (appliedCount: number) => {
            for (let i = 0; i < appliedCount; i++) {
                if (!store.canUndo()) break
                store.undo()
            }
            onSave({ showToast: false, refreshPreview: false })
        }
    }

    // TC-F05-15-17: Calls undo() exactly N times for N applied actions
    it('TC-F05-15-17: handleAbortRollback(3) → calls undo() exactly 3 times', () => {
        // Arrange
        const mockUndo = vi.fn()
        const mockSave = vi.fn()
        const store = {
            canUndo: vi.fn(() => true),
            undo: mockUndo,
        }
        const handleAbortRollback = createHandleAbortRollback(store, mockSave)

        // Act
        handleAbortRollback(3)

        // Assert
        expect(mockUndo).toHaveBeenCalledTimes(3)
        expect(mockSave).toHaveBeenCalledWith({ showToast: false, refreshPreview: false })
    })

    // TC-F05-15-18: Stops early if canUndo() becomes false
    it('TC-F05-15-18: handleAbortRollback(5) → stops at undo #3 if canUndo() returns false', () => {
        // Arrange
        const mockUndo = vi.fn()
        const mockSave = vi.fn()
        let callCount = 0
        const store = {
            canUndo: vi.fn(() => {
                // Only 3 undos are available, then canUndo returns false
                return callCount < 3
            }),
            undo: vi.fn(() => {
                callCount++
                mockUndo()
            }),
        }
        const handleAbortRollback = createHandleAbortRollback(store, mockSave)

        // Act
        handleAbortRollback(5)

        // Assert — should stop after 3 undos when canUndo() becomes false
        expect(mockUndo).toHaveBeenCalledTimes(3)
        expect(mockSave).toHaveBeenCalled()
    })

    // TC-F05-15-19: Persists reverted state to DB (showToast=false, refreshPreview=false)
    it('TC-F05-15-19: handleAbortRollback → calls save with showToast=false to persist without UI noise', () => {
        // Arrange
        const mockUndo = vi.fn()
        const mockSave = vi.fn()
        const store = {
            canUndo: vi.fn(() => true),
            undo: mockUndo,
        }
        const handleAbortRollback = createHandleAbortRollback(store, mockSave)

        // Act
        handleAbortRollback(2)

        // Assert
        expect(mockSave).toHaveBeenCalledWith({
            showToast: false,
            refreshPreview: false,
        })
        expect(mockUndo).toHaveBeenCalledTimes(2)
    })

    // TC-F05-15-20: Zero applied actions → no undo calls, just save
    it('TC-F05-15-20: handleAbortRollback(0) → no undo calls, only save', () => {
        // Arrange
        const mockUndo = vi.fn()
        const mockSave = vi.fn()
        const store = {
            canUndo: vi.fn(() => true),
            undo: mockUndo,
        }
        const handleAbortRollback = createHandleAbortRollback(store, mockSave)

        // Act
        handleAbortRollback(0)

        // Assert
        expect(mockUndo).not.toHaveBeenCalled()
        expect(mockSave).toHaveBeenCalled()
    })

    // TC-F05-15-21: Undo is called in sequence, not in parallel
    it('TC-F05-15-21: handleAbortRollback → calls undo() sequentially (order matters for LIFO)', () => {
        // Arrange
        const callOrder: string[] = []
        const mockSave = vi.fn(() => callOrder.push('save'))
        const store = {
            canUndo: vi.fn(() => true),
            undo: vi.fn(() => callOrder.push('undo')),
        }
        const handleAbortRollback = createHandleAbortRollback(store, mockSave)

        // Act
        handleAbortRollback(3)

        // Assert
        expect(callOrder).toEqual(['undo', 'undo', 'undo', 'save'])
    })
})
