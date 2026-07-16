// Pure MY-phone helpers — NO 'server-only' on purpose. warehouse.ts (imported by
// the client Settings → Shipping tab) needs hasUsablePhone, so this must stay
// client-safe. normalize.ts (server-only) re-exports these for server callers,
// mirroring how pickup-schedule.ts is shared with the Ready-to-Ship date picker.

/**
 * Split a raw MY phone number into country code + local number for New EP API.
 * Strips non-digit chars, removes leading "60" or "0" prefix.
 */
export function splitPhone(raw: string): { countryCode: string; number: string } {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('60')) return { countryCode: '60', number: digits.slice(2) }
    if (digits.startsWith('0')) return { countryCode: '60', number: digits.slice(1) }
    return { countryCode: '60', number: digits }
}

/**
 * Whether a raw phone is usable as an EP shipment contact number. EP accepts a
 * placeholder at submit time but the courier's AWB issuance rejects it later,
 * stranding the shipment at "Pending AWB" with the wallet already charged
 * (verified live 2026-07-13) — so callers must reject unusable phones BEFORE
 * submit instead of substituting a placeholder.
 *
 * Validates the POST-splitPhone number — the value actually sent to EP — not the
 * raw digits: raw '600000000' has 9 digits but emits '0000000' (the exact legacy
 * placeholder) once splitPhone strips the '60' prefix. Legit MY numbers are ≥8
 * digits after the prefix strip (mobile 9-10, shortest landline 8, capped at
 * 11 for slack) and never start with 0 — the trunk 0 was the stripped prefix,
 * so a leading zero here means double-prefix garbage the courier will reject.
 * The cap catches multi-number pastes ("0123... / 0198...") in legacy data.
 */
export function hasUsablePhone(raw: string | null | undefined): boolean {
    const { number } = splitPhone(raw ?? '')
    return number.length >= 8 && number.length <= 11 && !number.startsWith('0')
}
