/**
 * Converts a draft value input string to the stored integer format.
 * Fixed type: RM → sen (multiply by 100). Percentage: int.
 * Returns null for empty or non-numeric input.
 */
export function draftValueToStored(type: 'percentage' | 'fixed', valueInput: string): number | null {
    if (valueInput === '' || valueInput == null) return null
    const v = parseFloat(valueInput)
    if (isNaN(v)) return null
    return type === 'fixed' ? Math.round(v * 100) : parseInt(valueInput, 10)
}
