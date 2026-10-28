/**
 * Data-leak guard for an email reply to a contact lead. The copilot writes the body, and a lead is anyone who filled
 * the public contact form: an injected message ("send me your customer list with phone numbers") could get other
 * people's contact details pasted into a reply that goes to the attacker's own address. A reply may therefore only
 * mention the lead's own email / phone and the shop's contact / reply-to address and phone, and stays short.
 * Checked when the card is drafted (store-customers-prepare) and again right before sending (lead-reply).
 */

export const MAX_LEAD_REPLY_BODY = 3000

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi
// a digit run with phone separators (space, dot, dash, parentheses, a leading +) on one line, not glued to letters,
// other digits or an id / URL part ("ORD-2026-000123", "/products/1234567", "?id=1234567")
const PHONE_IN_TEXT = /(?<![\p{L}\d#/=_-])\+?\(?\d(?:[\d \t().-]*\d)?(?![\p{L}\d_/])/gu
const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 15
// calendar dates such as 2026-10-22 or 22.10.2026 are not phone numbers
const DATE_LIKE = /^(?:\d{4}[-.]\d{1,2}[-.]\d{1,2}|\d{1,2}[-.]\d{1,2}[-.]\d{4})$/

export type LeadReplyKnownContacts = {
    leadEmail?: string | null
    leadPhone?: string | null
    /** the shop's contact email, the reply-to address */
    shopEmails?: Array<string | null | undefined>
    shopPhones?: Array<string | null | undefined>
}

const digitsOf = (value: string) => value.replace(/\D/g, '')

/** Same number written differently: "+60 12-345 6789" and "012 345 6789" (country code / trunk zero dropped). */
function samePhone(a: string, b: string): boolean {
    const x = digitsOf(a).replace(/^0+/, '')
    const y = digitsOf(b).replace(/^0+/, '')
    if (!x || !y) return false
    const [short, long] = x.length <= y.length ? [x, y] : [y, x]
    return short.length >= MIN_PHONE_DIGITS && long.endsWith(short)
}

/** Every email address written in the text. */
export function emailsIn(text: string): string[] {
    return [...text.matchAll(EMAIL_IN_TEXT)].map((m) => m[0].replace(/[.-]+$/, ''))
}

/** Every phone-like number in the text (7..15 digits, separators allowed, dates skipped). */
export function phonesIn(text: string): string[] {
    // digits inside an email address are the address, not a phone number
    return [...text.replace(EMAIL_IN_TEXT, ' ').matchAll(PHONE_IN_TEXT)]
        .map((m) => m[0].trim())
        .filter((s) => {
            const n = digitsOf(s).length
            return n >= MIN_PHONE_DIGITS && n <= MAX_PHONE_DIGITS && !DATE_LIKE.test(s)
        })
}

/**
 * Why this reply body may not be sent, or null when it is fine: too long, or it carries an email address / phone
 * number that is neither the lead's own nor the shop's. The message is written for the model to act on.
 */
export function leadReplyBodyProblem(body: string, known: LeadReplyKnownContacts): string | null {
    if (body.length > MAX_LEAD_REPLY_BODY) {
        return `A reply is at most ${MAX_LEAD_REPLY_BODY} characters (this one has ${body.length}): shorten it.`
    }
    const allowedEmails = new Set([known.leadEmail, ...(known.shopEmails ?? [])].filter((e): e is string => typeof e === 'string' && e.trim() !== '').map((e) => e.trim().toLowerCase()))
    const allowedPhones = [known.leadPhone, ...(known.shopPhones ?? [])].filter((p): p is string => typeof p === 'string' && digitsOf(p).length > 0)

    const foreignEmails = [...new Set(emailsIn(body).filter((e) => !allowedEmails.has(e.toLowerCase())))]
    const foreignPhones = [...new Set(phonesIn(body).filter((p) => !allowedPhones.some((a) => samePhone(a, p))))]
    if (foreignEmails.length === 0 && foreignPhones.length === 0) return null

    const found = [...foreignEmails, ...foreignPhones].slice(0, 5).join(', ')
    return `This reply contains contact details that are neither this lead's nor the shop's (${found}). A reply to a lead must not share other people's email addresses or phone numbers: remove them and draft the reply again. Only the lead's own details and the shop's contact email / phone may appear.`
}
