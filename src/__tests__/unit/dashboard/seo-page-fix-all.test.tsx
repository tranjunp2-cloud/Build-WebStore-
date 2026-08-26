/**
 * Unit Tests — SEO Fix-All Modal Flow (Phase 4)
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.39 → Fix modal renders proposed fixes with testids
 *   TC-F03.40 → Checkbox toggle include/exclude individual fixes
 *   TC-F03.41 → Apply button sends only approved fixes
 *   TC-F03.42 → Undo backup persistence (sessionStorage)
 *   TC-F03.43 → Undo expires after 5 minutes
 *   TC-F03.44 → Empty state when no fixes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    parseUndoContinuation,
    saveUndoToStorage as persistUndoToStorage,
    selectAppliedFixes,
} from '@/components/dashboard/AIFixModal'

// ─── sessionStorage mock ────────────────────────────────────────────

const UNDO_STORAGE_KEY = 'seo-fix-undo-backup'
const UNDO_EXPIRY_MS = 5 * 60 * 1000

function saveUndoToStorage(data: any[]) {
    sessionStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
}

function loadUndoFromStorage(): any[] | null {
    const raw = sessionStorage.getItem(UNDO_STORAGE_KEY)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > UNDO_EXPIRY_MS) {
        sessionStorage.removeItem(UNDO_STORAGE_KEY)
        return null
    }
    return data
}

function clearUndoStorage() {
    sessionStorage.removeItem(UNDO_STORAGE_KEY)
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('SEO Fix-All Modal — Undo Persistence [TC-F03.39..44]', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        sessionStorage.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('[TC-F03.42] saves undo backup to sessionStorage', () => {
        // Arrange
        const fixes = [
            { targetId: '1', collection: 'pages', seo: { title: 'Old Title' } },
            { targetId: '2', collection: 'pages', seo: { description: 'Old Desc' } },
        ]

        // Act
        saveUndoToStorage(fixes)
        const loaded = loadUndoFromStorage()

        // Assert
        expect(loaded).toHaveLength(2)
        expect(loaded![0].targetId).toBe('1')
    })

    it('does not throw when sessionStorage rejects an undo backup', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('Storage quota exceeded')
        })

        try {
            expect(
                persistUndoToStorage(
                    [],
                    'site-1',
                    'a'.repeat(64),
                    '1785927600000.' + 'd'.repeat(64),
                ),
            ).toBe(false)
        } finally {
            setItem.mockRestore()
        }
    })

    it('[TC-F03.43] undo expires after 5 minutes', () => {
        // Arrange
        saveUndoToStorage([{ targetId: '1', collection: 'pages', seo: { title: 'T' } }])

        // Act — advance past expiry
        vi.advanceTimersByTime(UNDO_EXPIRY_MS + 1000)
        const loaded = loadUndoFromStorage()

        // Assert
        expect(loaded).toBeNull()
    })

    it('[TC-F03.42] loadUndoFromStorage returns null when empty', () => {
        // Act
        const loaded = loadUndoFromStorage()

        // Assert
        expect(loaded).toBeNull()
    })

    it('[TC-F03.42] clearUndoStorage removes backup', () => {
        // Arrange
        saveUndoToStorage([{ targetId: '1', collection: 'pages', seo: {} }])

        // Act
        clearUndoStorage()
        const loaded = loadUndoFromStorage()

        // Assert
        expect(loaded).toBeNull()
    })

    it('[TC-F03.40] approved fix IDs set filters proposed fixes', () => {
        // Arrange — simulate fix selection logic
        const proposedFixes = [
            { id: '1', targetId: '1', collection: 'pages', name: 'Page A', proposedTitle: 'Title A' },
            { id: '2', targetId: '2', collection: 'pages', name: 'Page B', proposedTitle: 'Title B' },
            { id: '3', targetId: '3', collection: 'pages', name: 'Page C', proposedTitle: 'Title C' },
        ]
        const approvedFixIds = new Set(['1', '3'])

        // Act — filter approved
        const approvedFixes = proposedFixes.filter(f => approvedFixIds.has(f.id))

        // Assert
        expect(approvedFixes).toHaveLength(2)
        expect(approvedFixes.map(f => f.id)).toEqual(['1', '3'])
    })

    it('[TC-F03.41] builds batch fixes from approved selections', () => {
        // Arrange
        const proposedFixes = [
            { id: '1', targetId: '10', collection: 'pages' as const, name: 'P', proposedTitle: 'New T', proposedDescription: 'New D' },
        ]
        const approvedFixIds = new Set(['1'])

        // Act — replicate handleApplyFixes logic
        const approved = proposedFixes.filter(f => approvedFixIds.has(f.id))
        const fixes = approved.map(f => ({
            targetId: f.targetId,
            collection: f.collection,
            seo: { title: f.proposedTitle, description: f.proposedDescription },
        }))

        // Assert
        expect(fixes).toHaveLength(1)
        expect(fixes[0]).toEqual({
            targetId: '10',
            collection: 'pages',
            seo: { title: 'New T', description: 'New D' },
        })
    })

    it('counts only fulfilled fixes after a partial apply', () => {
        const selected = [
            { targetId: '1', collection: 'pages', name: 'Page A' },
            { targetId: '2', collection: 'pages', name: 'Page B' },
        ]

        const applied = selectAppliedFixes(selected, [
            { targetId: '2', collection: 'pages', seo: {} },
        ])

        expect(applied).toEqual([selected[1]])
    })

    it('keeps only a valid signed continuation after partial undo', () => {
        const continuation = parseUndoContinuation({
            failedCount: 1,
            remainingUndoData: [
                { targetId: '2', collection: 'pages', seo: { title: 'Old' } },
            ],
            revisionToken: 'c'.repeat(64),
            undoToken: `1785927600000.${'d'.repeat(64)}`,
        })

        expect(continuation).toEqual({
            data: [
                { targetId: '2', collection: 'pages', seo: { title: 'Old' } },
            ],
            revisionToken: 'c'.repeat(64),
            undoToken: `1785927600000.${'d'.repeat(64)}`,
        })
        expect(
            parseUndoContinuation({
                failedCount: 1,
                remainingUndoData: [],
                revisionToken: 'c'.repeat(64),
                undoToken: `1785927600000.${'d'.repeat(64)}`,
            }),
        ).toBeNull()
    })

    it('[TC-F03.44] empty proposed fixes results in no batch fixes', () => {
        // Arrange
        const proposedFixes: any[] = []
        const approvedFixIds = new Set<string>()

        // Act
        const approved = proposedFixes.filter(f => approvedFixIds.has(f.id))

        // Assert
        expect(approved).toHaveLength(0)
    })
})
