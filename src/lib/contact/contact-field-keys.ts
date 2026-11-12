/**
 * GH-2243 — canonical request keys for contact-form fields.
 *
 * /api/contact-submit only understands name/email/phone/subject/message, but AI-generated (or
 * owner-edited) blocks carry free-text `fieldName` values ("nama", "emel", or even a shop
 * description). One shared mapping is used by the storefront form (render side) and by the AI
 * post-processing (data side) so both agree on which field is which.
 */

export type ContactFieldKeyInput = { fieldName?: unknown; fieldType?: unknown; type?: unknown }

export type ContactFieldKeyOptions = {
    /**
     * Map any unrecognised `text` field to name/subject (render side: the value must reach the API).
     * When false only empty / generic ("field", "field-2") names are mapped; custom names are kept
     * (data side: do not rename an owner's custom field such as "companyName").
     */
    mapCustomText?: boolean
}

export const CANONICAL_CONTACT_KEYS = ['name', 'email', 'phone', 'subject', 'message'] as const
export type CanonicalContactKey = (typeof CANONICAL_CONTACT_KEYS)[number]

const ALIASES: Record<CanonicalContactKey, string[]> = {
    name: ['name', 'fullname', 'contactname', 'yourname', 'nama', 'namapenuh', 'namaanda'],
    email: ['email', 'emailaddress', 'emel', 'alamatemel'],
    phone: ['phone', 'phonenumber', 'telephone', 'tel', 'telefon', 'notelefon', 'nombortelefon'],
    message: ['message', 'yourmessage', 'mesej', 'pesanan'],
    subject: ['subject', 'topic', 'subjek', 'tajuk'],
}

const ALIAS_LOOKUP = new Map<string, CanonicalContactKey>(
    (Object.entries(ALIASES) as Array<[CanonicalContactKey, string[]]>).flatMap(([key, list]) =>
        list.map((alias) => [alias, key] as [string, CanonicalContactKey]),
    ),
)

const TYPE_KEYS: Record<string, CanonicalContactKey> = {
    email: 'email',
    phone: 'phone',
    tel: 'phone',
    textarea: 'message',
}

const GENERIC_NAME = /^field(?:[-_\s]*\d+)?$/

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Resolve the key each field submits under, in field order. Keys are unique within the form. */
export function resolveContactFieldKeys(
    fields: ReadonlyArray<ContactFieldKeyInput>,
    { mapCustomText = true }: ContactFieldKeyOptions = {},
): string[] {
    const keys: Array<string | null> = fields.map(() => null)
    // 'website' is the honeypot input: no visible field may resolve to it.
    const used = new Set<string>(['website'])
    const claim = (i: number, key: string): void => {
        keys[i] = key
        used.add(key)
    }
    const typeOf = (f: ContactFieldKeyInput): string => str(f.fieldType ?? f.type).toLowerCase()
    const aliasOf = (f: ContactFieldKeyInput): CanonicalContactKey | undefined =>
        ALIAS_LOOKUP.get(str(f.fieldName).toLowerCase().replace(/[^a-z0-9]/g, ''))

    // Pass 1: recognised names (English + Malay).
    fields.forEach((f, i) => {
        const alias = aliasOf(f)
        if (alias && !used.has(alias)) claim(i, alias)
    })

    // Pass 2: by field type; a text field becomes name, then subject.
    fields.forEach((f, i) => {
        if (keys[i]) return
        const type = typeOf(f)
        const typed = TYPE_KEYS[type]
        if (typed) {
            if (!used.has(typed)) claim(i, typed)
            return
        }
        if (type !== 'text' && type !== '') return
        const raw = str(f.fieldName)
        if (!mapCustomText && raw && !GENERIC_NAME.test(raw.toLowerCase())) return
        const free = (['name', 'subject'] as const).find((k) => !used.has(k))
        if (free) claim(i, free)
    })

    // Pass 3: keep the original name when unique, else field-N. Never reuse a canonical key.
    return keys.map((key, i) => {
        if (key) return key
        const original = str(fields[i]?.fieldName)
        if (original && !used.has(original)) {
            used.add(original)
            return original
        }
        let n = i + 1
        while (used.has(`field-${n}`)) n += 1
        used.add(`field-${n}`)
        return `field-${n}`
    })
}
