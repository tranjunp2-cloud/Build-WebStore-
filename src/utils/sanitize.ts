/**
 * Strip all HTML tags from a string.
 * This is used to aggressively sanitize search inputs and text displays 
 * to prevent XSS attacks (QA TC-F20.05).
 * 
 * @param input The potentially unsafe string containing HTML
 * @returns A safe, plain text string with all HTML tags removed
 */
export function sanitizeText(input: string | null | undefined): string {
    if (!input) return '';
    // Replace <...> blocks with empty string to strip HTML
    return input.replace(/<\/?[^>]+(>|$)/g, '').trim();
}
