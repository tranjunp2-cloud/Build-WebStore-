export interface TemplateSwapSaveState {
    hasUnsavedChanges: boolean
    saveInFlight: boolean
    saveQueued: boolean
}

export interface TemplateSwapRevisionState extends TemplateSwapSaveState {
    contentRevision: number
}

/**
 * A template swap reads the persisted draft inside its transaction. Flush only
 * when local work can still be newer than that draft; a clean editor already
 * represents the authoritative editor-data response.
 */
export function shouldSaveBeforeTemplateSwap(state: TemplateSwapSaveState): boolean {
    return state.hasUnsavedChanges || state.saveInFlight || state.saveQueued
}

/**
 * A successful PATCH is only a valid template-swap barrier when no newer
 * editor revision appeared while that request was in flight.
 */
export function isTemplateSwapDraftStable(
    savedRevision: number,
    state: TemplateSwapRevisionState,
): boolean {
    return state.contentRevision === savedRevision && !shouldSaveBeforeTemplateSwap(state)
}
