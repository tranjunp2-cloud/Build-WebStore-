/** localStorage prefix of the editor AI chat history (one key per site). */
export const EDITOR_CHAT_STORAGE_PREFIX = 'editor-chat-'

/**
 * Drops AI conversation history kept in this browser, so the next person to
 * sign in on a shared machine never sees the previous user's requests.
 * Call on every sign-out path, before redirecting.
 */
export function clearClientAiState(storage: Storage | undefined = globalThis.localStorage): void {
    if (!storage) return
    try {
        const keys: string[] = []
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i)
            if (key?.startsWith(EDITOR_CHAT_STORAGE_PREFIX)) keys.push(key)
        }
        for (const key of keys) storage.removeItem(key)
    } catch {
        // Storage can be unavailable (private mode, quota); sign-out must still go ahead.
    }
}
