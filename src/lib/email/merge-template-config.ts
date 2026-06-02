/**
 * Merge + variable substitution utilities for email templates (F32).
 * Applies CMS overrides on top of hard-coded defaults and substitutes {var} tokens.
 */
import type { EmailTemplateConfig } from './types'

const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char)
}

/**
 * Replaces {varName} tokens in a string using the provided vars map.
 * Unknown tokens are left as-is. Substituted values are HTML-escaped
 * to prevent injection attacks.
 *
 * @param input - Template string containing {varName} placeholders
 * @param vars  - Map of variable names to their string/number values
 */
export function applyVariables(
    input: string | undefined,
    vars: Record<string, string | number>,
): string | undefined {
    if (input === undefined) return undefined
    return input.replace(/\{([^}]+)\}/g, (_match, key: string) => {
        if (Object.prototype.hasOwnProperty.call(vars, key)) {
            return escapeHtml(String(vars[key]))
        }
        return _match // leave unknown tokens intact
    })
}

/**
 * Returns a merged copy of `defaults` with CMS config fields applied and
 * variable tokens substituted.
 *
 * Rules:
 * - If `config` is null → return defaults with variables substituted.
 * - For each mapped field: override default only when config field is a non-empty string.
 * - All overridden and default string values have {var} tokens substituted.
 *
 * @param defaults  - Hard-coded template defaults object
 * @param config    - CMS config (may be null when no override exists)
 * @param vars      - Variable substitution map
 * @param fieldMap  - Maps EmailTemplateConfig keys to keys in `defaults`
 */
export function mergeTemplateConfig<T extends Record<string, unknown>>(
    defaults: T,
    config: EmailTemplateConfig | null,
    vars: Record<string, string | number>,
    fieldMap: {
        subject?: keyof T
        greeting?: keyof T
        ctaLabel?: keyof T
        closing?: keyof T
    },
): T {
    const result = { ...defaults }

    // Note: 'subject' removed from EmailTemplateConfig — CMS no longer overrides subject lines.
    // The fieldMap still accepts a subject key for defaults-only variable substitution.
    const configKeys = ['greeting', 'ctaLabel', 'closing'] as const

    for (const configKey of configKeys) {
        const defaultsKey = fieldMap[configKey]
        if (!defaultsKey) continue

        const configValue = config?.[configKey]
        const baseValue =
            typeof configValue === 'string' && configValue.length > 0
                ? escapeHtml(configValue)
                : (defaults[defaultsKey] as string | undefined)

        result[defaultsKey] = applyVariables(baseValue, vars) as T[keyof T]
    }

    // Apply variable substitution to the subject from defaults only (no CMS override)
    if (fieldMap.subject) {
        const subjectDefault = defaults[fieldMap.subject] as string | undefined
        result[fieldMap.subject] = applyVariables(subjectDefault, vars) as T[keyof T]
    }

    return result
}
