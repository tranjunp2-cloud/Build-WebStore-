/**
 * Shared constants for the Lark group card (new feedback card, card buttons, overdue digest).
 * Both Web v2 tables live in one shared Base; the card callback accepts only these two.
 */
export const STAGING_TABLE_ID = 'tblTg9HUG2eLWwSd'
export const PRODUCTION_TABLE_ID = 'tblqzGZEcvkfX6xJ'
export const ALLOWED_TABLE_IDS: readonly string[] = [STAGING_TABLE_ID, PRODUCTION_TABLE_ID]

export const BASE_URL = 'https://primecommerce.sg.larksuite.com/base'
export const EVENT_TIME_ZONE = 'Asia/Kuala_Lumpur'

export const CLOSED_STATUSES = ['Resolved', "Won't Fix"] as const

/** Which environment a table belongs to; null for a table this feature does not serve. */
export function environmentOf(tableId: string): 'Staging' | 'Production' | null {
    if (tableId === STAGING_TABLE_ID) return 'Staging'
    if (tableId === PRODUCTION_TABLE_ID) return 'Production'
    return null
}

/** Deep link to one record (or to the table when the record id is unknown). */
export function recordUrl(appToken: string, tableId: string, recordId?: string): string {
    const table = `${BASE_URL}/${appToken}?table=${tableId}`
    return recordId ? `${table}&record=${recordId}` : table
}

const MD_ENTITIES: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '*': '&#42;', _: '&#95;', '~': '&#126;', '`': '&#96;', '[': '&#91;', ']': '&#93;',
}

/**
 * Entity-escape text for a lark_md element. A raw `<` can never survive, so user-supplied text (reporter name,
 * store name) cannot form an `<at id=all>` mention or a link, whatever escape syntax lark_md understands.
 * User text on cards goes into plain_text elements; this is for the places that need lark_md (digest lines).
 */
export function md(value: unknown): string {
    return String(value ?? '').replace(/[&<>*_~`[\]]/g, (c) => MD_ENTITIES[c])
}
