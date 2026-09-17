import { createHash } from 'crypto'

/**
 * A JSON field is stored as Postgres JSONB, which does not preserve the
 * insertion order of object keys. Hashing `JSON.stringify(value)` therefore
 * makes an unchanged, reloaded snapshot look tampered with. Canonicalize keys
 * recursively before hashing so capture and recovery use the same bytes.
 */
export function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return canonicalScalar(value)
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
    const object = value as Record<string, unknown>
    // PostgreSQL uses bytewise UTF-8 ordering below (`convert_to(key, 'UTF8')`)
    // for the one-time JSONB backfill. Do not use locale/UTF-16 ordering here:
    // user-supplied contentBrief keys can contain Vietnamese or astral Unicode.
    const compareUtf8 = (left: string, right: string) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
    // Match JSON serialization: object properties with undefined-like values
    // are omitted. Payload snapshots are JSON, but retaining this behavior
    // makes the helper safe when called before a value reaches JSONB.
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort(compareUtf8).map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`
}

function canonicalScalar(value: unknown): string {
    if (typeof value !== 'number') return JSON.stringify(value) ?? 'null'
    // PostgreSQL JSONB renders numbers in plain decimal notation. JavaScript
    // uses exponent notation for values below 1e-6 or at least 1e21, which
    // would make a snapshot change hash merely by being read back from JSONB.
    if (!Number.isFinite(value)) return 'null'
    return expandExponential(value.toString())
}

function expandExponential(numberText: string): string {
    if (!/[eE]/.test(numberText)) return numberText

    const [coefficient, exponentText] = numberText.toLowerCase().split('e')
    const exponent = Number(exponentText)
    const negative = coefficient.startsWith('-')
    const unsigned = negative ? coefficient.slice(1) : coefficient
    const [whole, fraction = ''] = unsigned.split('.')
    const digits = `${whole}${fraction}`
    const decimalIndex = whole.length + exponent
    const sign = negative ? '-' : ''

    if (decimalIndex <= 0) return `${sign}0.${'0'.repeat(-decimalIndex)}${digits}`
    if (decimalIndex >= digits.length) return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`
    return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
}

export function hashGenerationSnapshot(snapshot: unknown): string {
    return createHash('sha256').update(canonicalJson(snapshot), 'utf8').digest('hex')
}
