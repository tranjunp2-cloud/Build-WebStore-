/**
 * When may the assistant's change be put into the page? A change replaces the page draft the editor holds, so it
 * must never land while the merchant is mid-edit: text they typed that is not saved yet would be replaced.
 *
 *  - by hand (the Approve button): the merchant clicked away from the canvas, so only an open canvas text
 *    session is waited for (it closes and saves on its own a moment after the click);
 *  - Auto-approve: the merchant did not ask for this now, so it also waits until nothing is unsaved (autosave
 *    flushed) and nothing changed for a short quiet moment.
 */

export type EditorActivity = {
    isInlineEditing: boolean
    hasUnsavedChanges: boolean
    isSaving: boolean
    contentRevision: number
}

export type IdleOptions = {
    /** also wait for autosave to flush (Auto-approve) */
    requireSaved: boolean
    /** nothing may change for this long (ms) */
    quietMs: number
    /** give up after this long (ms) */
    timeoutMs: number
    pollMs?: number
}

export const MANUAL_IDLE: IdleOptions = { requireSaved: false, quietMs: 0, timeoutMs: 4000 }
export const AUTO_IDLE: IdleOptions = { requireSaved: true, quietMs: 1500, timeoutMs: 5000 }

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** True once the editor is idle (as `options` define it); false when it never became so within the timeout. */
export async function waitForEditorIdle(read: () => EditorActivity, options: IdleOptions): Promise<boolean> {
    const poll = options.pollMs ?? 150
    const deadline = Date.now() + options.timeoutMs
    let revision = read().contentRevision
    let stableSince = Date.now()
    for (;;) {
        const now = read()
        if (now.contentRevision !== revision) {
            revision = now.contentRevision
            stableSince = Date.now()
        }
        const busy = now.isInlineEditing || (options.requireSaved && (now.hasUnsavedChanges || now.isSaving))
        if (!busy && Date.now() - stableSince >= options.quietMs) return true
        if (Date.now() >= deadline) return false
        await sleep(poll)
    }
}
