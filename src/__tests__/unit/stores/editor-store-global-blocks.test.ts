/**
 * Unit Tests — EditorStore globalBlocks actions
 * Coverage Map:
 *   TC-F10-GBL-020 → init with globalBlocks → state populated
 *   TC-F10-GBL-021 → updateGlobalBlock merges patch + pushes undo snapshot
 *   TC-F10-GBL-022 → updateGlobalBlock on missing key creates entry
 *   TC-F10-GBL-023 → deleteGlobalBlock sets entry to null + snapshot
 *   TC-F10-GBL-024 → undo after updateGlobalBlock restores globalBlocks
 *   TC-F10-GBL-025 → flipBlockVariant floating→inline: globalBlocks cleared, blocks gains inline
 *   TC-F10-GBL-026 → flipBlockVariant inline→floating: blocks spliced, globalBlocks set
 *   TC-F10-GBL-027 → performSave body includes globalBlocks when non-null
 *   TC-F10-GBL-028 → performSave body omits globalBlocks when state never set (null)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import type { BlockData } from '@/store/editorStore'

const makeBlock = (type: string, extra?: Record<string, unknown>): BlockData =>
    ({ blockType: type, ...extra })

const CART_ENTRY = { blockType: 'cartWidget', variant: 'floating', showCount: true }
const WA_ENTRY = { blockType: 'whatsapp-button', phoneNumber: '+60123456789' }
const INITIAL_GB = { cartWidget: CART_ENTRY, whatsappButton: null, socialWidget: null }

describe('EditorStore — globalBlocks actions', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // ── TC-F10-GBL-020 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-020] init with globalBlocks populates state', () => {
        // Arrange / Act
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero')],
            {},
            'Test Site',
            null,
            null,
            INITIAL_GB,
        )

        // Assert
        const { globalBlocks } = useEditorStore.getState()
        expect(globalBlocks).not.toBeNull()
        expect(globalBlocks?.cartWidget).toEqual(CART_ENTRY)
        expect(globalBlocks?.whatsappButton).toBeNull()
    })

    // ── TC-F10-GBL-021 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-021] updateGlobalBlock merges patch and pushes undo snapshot', () => {
        // Arrange
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test', null, null, INITIAL_GB)
        const historyBefore = useEditorStore.getState().history.length

        // Act
        useEditorStore.getState().updateGlobalBlock('cartWidget', { label: 'My Cart' })

        // Assert
        const { globalBlocks, history } = useEditorStore.getState()
        expect((globalBlocks?.cartWidget as Record<string, unknown>)?.label).toBe('My Cart')
        expect(history.length).toBe(historyBefore + 1)
        expect(history[history.length - 1].label).toBe('Updated cartWidget')
    })

    // ── TC-F10-GBL-022 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-022] updateGlobalBlock on missing key creates new entry', () => {
        // Arrange — init with null globalBlocks
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test')

        // Act
        useEditorStore.getState().updateGlobalBlock('whatsappButton', { phoneNumber: '+60111222333' })

        // Assert
        const { globalBlocks } = useEditorStore.getState()
        expect(globalBlocks?.whatsappButton).toBeDefined()
        expect((globalBlocks?.whatsappButton as Record<string, unknown>)?.phoneNumber).toBe('+60111222333')
    })

    // ── TC-F10-GBL-023 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-023] deleteGlobalBlock sets entry to null and pushes undo snapshot', () => {
        // Arrange
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test', null, null, INITIAL_GB)
        const historyBefore = useEditorStore.getState().history.length

        // Act
        useEditorStore.getState().deleteGlobalBlock('cartWidget')

        // Assert
        const { globalBlocks, history } = useEditorStore.getState()
        expect(globalBlocks?.cartWidget).toBeNull()
        expect(history.length).toBe(historyBefore + 1)
        expect(history[history.length - 1].label).toBe('Deleted cartWidget')
    })

    // ── TC-F10-GBL-024 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-024] undo after updateGlobalBlock restores previous globalBlocks', () => {
        // Arrange
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test', null, null, INITIAL_GB)
        const originalCart = JSON.parse(JSON.stringify(useEditorStore.getState().globalBlocks?.cartWidget))

        // Act
        useEditorStore.getState().updateGlobalBlock('cartWidget', { label: 'Changed' })
        useEditorStore.getState().undo()

        // Assert
        const { globalBlocks } = useEditorStore.getState()
        expect(globalBlocks?.cartWidget).toEqual(originalCart)
    })

    // ── TC-F10-GBL-025 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-025] flipBlockVariant floating→inline: globalBlocks cleared, blocks gains inline cart', () => {
        // Arrange — globalBlocks has cartWidget, no inline in blocks
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test', null, null, INITIAL_GB)
        const historyBefore = useEditorStore.getState().history.length

        // Act — floating → inline (sourceIndex undefined since it comes from globalBlocks)
        useEditorStore.getState().flipBlockVariant('cartWidget', 'inline', undefined)

        // Assert
        const { globalBlocks, blocks, history } = useEditorStore.getState()
        expect(globalBlocks?.cartWidget).toBeNull()
        expect(blocks.some(b => b.blockType === 'cartWidget' && (b as Record<string, unknown>).variant === 'inline')).toBe(true)
        expect(history.length).toBe(historyBefore + 1)
    })

    // ── TC-F10-GBL-026 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-026] flipBlockVariant inline→floating: blocks spliced at index, globalBlocks set', () => {
        // Arrange — inline cart at index 1
        const inlineCart = makeBlock('cartWidget', { variant: 'inline' })
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero'), inlineCart, makeBlock('footer')],
            {},
            'Test',
        )
        const historyBefore = useEditorStore.getState().history.length

        // Act
        useEditorStore.getState().flipBlockVariant('cartWidget', 'floating', 1)

        // Assert
        const { globalBlocks, blocks, history } = useEditorStore.getState()
        expect(blocks).toHaveLength(2)
        expect(blocks.every(b => b.blockType !== 'cartWidget')).toBe(true)
        expect(globalBlocks?.cartWidget).toBeDefined()
        expect((globalBlocks?.cartWidget as Record<string, unknown>)?.variant).toBe('floating')
        expect(history.length).toBe(historyBefore + 1)
    })

    // ── TC-F10-GBL-027 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-027] performSave body includes globalBlocks when state is non-null', async () => {
        // Arrange
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test', null, null, INITIAL_GB)

        let capturedBody: Record<string, unknown> | null = null
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        })
        vi.stubGlobal('fetch', fetchSpy)

        // Act
        await useEditorStore.getState().performSave()

        // Assert
        expect(fetchSpy).toHaveBeenCalled()
        const [, options] = fetchSpy.mock.calls[0]
        capturedBody = JSON.parse(options.body as string)
        expect(capturedBody).toHaveProperty('globalBlocks')
        expect(capturedBody?.globalBlocks).toEqual(INITIAL_GB)
    })

    // ── TC-F10-GBL-028 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-028] performSave body omits globalBlocks when state is null', async () => {
        // Arrange — init without globalBlocks (stays null)
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test')

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        })
        vi.stubGlobal('fetch', fetchSpy)

        // Act
        await useEditorStore.getState().performSave()

        // Assert
        expect(fetchSpy).toHaveBeenCalled()
        const [, options] = fetchSpy.mock.calls[0]
        const body = JSON.parse(options.body as string)
        expect(body).not.toHaveProperty('globalBlocks')
    })

    it('flipBlockVariant noop when blockType not in BLOCK_TYPE_TO_KEY', () => {
        useEditorStore.getState().init('site-1', [makeBlock('hero'), makeBlock('unknown-type')], {}, 'Test')
        const blocksBefore = useEditorStore.getState().blocks.length
        useEditorStore.getState().flipBlockVariant('unknown-type', 'floating', 1)
        expect(useEditorStore.getState().blocks.length).toBe(blocksBefore)
    })
})
