export type ServerFieldErrorEntry = { code: string; values?: string[] }

export type ServerErrorPayload = {
    code: 'FIELD_ERRORS'
    fieldErrors: Record<string, ServerFieldErrorEntry>
    message: string
}

/** Parses a server action Error into a structured payload, or returns null for plain errors. */
export function parseServerError(err: unknown): ServerErrorPayload | null {
    if (!(err instanceof Error)) return null
    try {
        const parsed = JSON.parse(err.message)
        if (
            parsed &&
            typeof parsed === 'object' &&
            parsed.code === 'FIELD_ERRORS' &&
            parsed.fieldErrors &&
            typeof parsed.message === 'string'
        ) {
            return parsed as ServerErrorPayload
        }
    } catch { /* not JSON — plain error */ }
    return null
}

/** Resolves a server field error entry to a localized message string. */
export function localizeFieldError(
    entry: ServerFieldErrorEntry,
    errorsMap: Record<string, string> | undefined
): string {
    switch (entry.code) {
        case 'SKU_ALREADY_IN_USE': {
            const template = errorsMap?.skuAlreadyInUse || 'SKU "{value}" is already in use'
            return template.replace('{value}', entry.values?.[0] || '')
        }
        default:
            // Unknown code — return code itself so it's discoverable in QA
            return entry.code
    }
}
