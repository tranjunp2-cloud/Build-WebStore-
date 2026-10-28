// @vitest-environment jsdom
/**
 * TC-AISEC-08 — sign-out drops the AI conversation kept in this browser.
 * clearClientAiState removes only `editor-chat-*` keys; it runs on every logout path
 * (UserAvatarMenu, EditorMenuDrawer, TenantAccessWatcher).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { clearClientAiState, EDITOR_CHAT_STORAGE_PREFIX } from '@/lib/auth/clear-client-ai-state'

describe('clearClientAiState [TC-AISEC-08]', () => {
    beforeEach(() => {
        localStorage.clear()
        sessionStorage.clear()
    })

    it('uses the editor-chat- prefix for the per-site history keys', () => {
        expect(EDITOR_CHAT_STORAGE_PREFIX).toBe('editor-chat-')
    })

    it('removes the chat history of every site', () => {
        localStorage.setItem('editor-chat-site-1', '{"v":2}')
        localStorage.setItem('editor-chat-site-2', '{"v":2}')

        clearClientAiState()

        expect(localStorage.getItem('editor-chat-site-1')).toBeNull()
        expect(localStorage.getItem('editor-chat-site-2')).toBeNull()
    })

    it('removes every chat key when many are stored (no key skipped while the store shrinks)', () => {
        for (let i = 0; i < 25; i++) localStorage.setItem(`editor-chat-site-${i}`, '{"v":2}')

        clearClientAiState()

        expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
            .filter((key) => key?.startsWith('editor-chat-'))).toEqual([])
    })

    it('keeps unrelated keys, including ones that only look similar', () => {
        localStorage.setItem('editor-chat-site-1', '{"v":2}')
        localStorage.setItem('editor-chatter', 'keep')
        localStorage.setItem('editor-chat', 'keep')
        localStorage.setItem('theme-pref', 'dark')

        clearClientAiState()

        expect(localStorage.getItem('editor-chatter')).toBe('keep')
        expect(localStorage.getItem('editor-chat')).toBe('keep')
        expect(localStorage.getItem('theme-pref')).toBe('dark')
    })

    it('clears the storage it is given, not only localStorage', () => {
        sessionStorage.setItem('editor-chat-site-9', '{"v":2}')
        localStorage.setItem('editor-chat-site-9', '{"v":2}')

        clearClientAiState(sessionStorage)

        expect(sessionStorage.getItem('editor-chat-site-9')).toBeNull()
        expect(localStorage.getItem('editor-chat-site-9')).toBe('{"v":2}')
    })

    it('does nothing when no storage is available', () => {
        expect(() => clearClientAiState(null as unknown as Storage)).not.toThrow()
    })

    it('does not throw when storage is unavailable, so sign-out still goes ahead', () => {
        const broken = {
            get length(): number {
                throw new Error('SecurityError: storage is disabled')
            },
        } as unknown as Storage

        expect(() => clearClientAiState(broken)).not.toThrow()
    })
})
