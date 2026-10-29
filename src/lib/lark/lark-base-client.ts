import 'server-only'

/**
 * Minimal Lark Open API client for Base (Bitable) record creation.
 * Auth: custom-app tenant_access_token (app_id + app_secret), cached until shortly before expiry.
 * Refs: auth/v3/tenant_access_token/internal, bitable/v1/apps/:app_token/tables/:table_id/records.
 */

const DEFAULT_API_BASE = 'https://open.larksuite.com/open-apis'
const REQUEST_TIMEOUT_MS = 10_000
const UPLOAD_TIMEOUT_MS = 30_000
// Refresh this long before the reported expiry (token lives ≤ 2h; Lark rotates in the last 30 min).
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000

export class LarkApiError extends Error {
    constructor(
        message: string,
        /** Lark business code (0 = ok); null when the failure was transport-level. */
        readonly code: number | null,
        readonly httpStatus: number | null,
    ) {
        super(message)
        this.name = 'LarkApiError'
    }
}

let cachedToken: { value: string; expiresAt: number } | null = null

function apiBase(): string {
    return (process.env.LARK_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '')
}

async function larkFetch(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<{ status: number; body: any }> {
    let res: Response
    try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    } catch (err) {
        throw new LarkApiError(`Lark request failed: ${(err as Error).name}`, null, null)
    }
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
}

async function getTenantAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value

    const appId = process.env.LARK_APP_ID
    const appSecret = process.env.LARK_APP_SECRET
    if (!appId || !appSecret) throw new LarkApiError('LARK_APP_ID / LARK_APP_SECRET not configured', null, null)

    const { status, body } = await larkFetch(`${apiBase()}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    })
    if (status !== 200 || body?.code !== 0 || typeof body?.tenant_access_token !== 'string') {
        throw new LarkApiError('Lark tenant_access_token request rejected', body?.code ?? null, status)
    }
    cachedToken = {
        value: body.tenant_access_token,
        expiresAt: Date.now() + Math.max(0, (body.expire ?? 0) * 1000 - TOKEN_REFRESH_MARGIN_MS),
    }
    return cachedToken.value
}

export type CreateBaseRecordInput = {
    appToken: string
    tableId: string
    fields: Record<string, unknown>
    /** UUID v4. Lark answers a reused one with success and the same record (no duplicate, no error). */
    clientToken: string
}

/** Creates one Base record. Returns the Lark record id. Throws LarkApiError on any failure. */
export async function createBaseRecord(input: CreateBaseRecordInput): Promise<{ recordId: string }> {
    const token = await getTenantAccessToken()
    const url = `${apiBase()}/bitable/v1/apps/${encodeURIComponent(input.appToken)}/tables/${encodeURIComponent(input.tableId)}/records?client_token=${encodeURIComponent(input.clientToken)}`
    const { status, body } = await larkFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: input.fields }),
    })
    if (status !== 200 || body?.code !== 0) {
        // Drop the cached token on auth-looking failures so the next call re-authenticates.
        if (status === 401 || status === 403) cachedToken = null
        throw new LarkApiError('Lark create record rejected', body?.code ?? null, status)
    }
    return { recordId: String(body?.data?.record?.record_id ?? '') }
}

type RecordsRef = { appToken: string; tableId: string }

const recordsUrl = (ref: RecordsRef, suffix = ''): string =>
    `${apiBase()}/bitable/v1/apps/${encodeURIComponent(ref.appToken)}/tables/${encodeURIComponent(ref.tableId)}/records${suffix}`

/** Authenticated JSON call; returns Lark `data`. Throws LarkApiError unless HTTP 200 + code 0. */
async function larkJson(method: string, url: string, payload: unknown, what: string): Promise<any> {
    const token = await getTenantAccessToken()
    const { status, body } = await larkFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    })
    if (status !== 200 || body?.code !== 0) {
        if (status === 401 || status === 403) cachedToken = null
        throw new LarkApiError(`Lark ${what} rejected`, body?.code ?? null, status)
    }
    return body?.data ?? {}
}

/** Reads one record. Person columns come back as `[{ id: open_id, name }]`. */
export async function getBaseRecord(ref: RecordsRef & { recordId: string }): Promise<Record<string, unknown>> {
    const data = await larkJson('GET', recordsUrl(ref, `/${encodeURIComponent(ref.recordId)}?user_id_type=open_id`), undefined, 'get record')
    return data.record?.fields ?? {}
}

/** Changes some columns of one record; columns not named stay as they are. */
export async function updateBaseRecord(ref: RecordsRef & { recordId: string; fields: Record<string, unknown> }): Promise<void> {
    await larkJson('PUT', recordsUrl(ref, `/${encodeURIComponent(ref.recordId)}?user_id_type=open_id`), { fields: ref.fields }, 'update record')
}

export type BaseSearchResult = { recordId: string; fields: Record<string, unknown> }

/** Records matching a Lark filter (first 200). Person columns are keyed by open_id. */
export async function searchBaseRecords(
    ref: RecordsRef & { filter: Record<string, unknown>; fieldNames: string[] },
): Promise<BaseSearchResult[]> {
    const data = await larkJson(
        'POST',
        recordsUrl(ref, '/search?page_size=200&user_id_type=open_id'),
        { filter: ref.filter, field_names: ref.fieldNames },
        'search records',
    )
    return (data.items ?? []).map((item: any) => ({ recordId: String(item.record_id ?? ''), fields: item.fields ?? {} }))
}

/** Sends an interactive card to a chat as the app bot. `card` is the card JSON body. */
export async function sendChatCard(chatId: string, card: unknown): Promise<void> {
    await larkJson(
        'POST',
        `${apiBase()}/im/v1/messages?receive_id_type=chat_id`,
        { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
        'send card',
    )
}

/** Delayed card update: the callback token (valid ~30 min) replaces the card the user pressed. */
export async function updateCardAfterCallback(callbackToken: string, card: unknown): Promise<void> {
    await larkJson('POST', `${apiBase()}/interactive/v1/card/update`, { token: callbackToken, card }, 'card update')
}

export type UploadBaseImageInput = {
    /** Base (app) token the file is attached to; a file_token only works inside this Base. */
    appToken: string
    fileName: string
    mime: string
    bytes: Uint8Array
}

/**
 * Uploads an image as Base attachment media (drive/v1/medias/upload_all, parent_type=bitable_image).
 * The returned file_token goes into an Attachment cell; it does not need the record to exist yet.
 */
export async function uploadBaseImage(input: UploadBaseImageInput): Promise<{ fileToken: string }> {
    const token = await getTenantAccessToken()
    const form = new FormData()
    form.append('file_name', input.fileName)
    form.append('parent_type', 'bitable_image')
    form.append('parent_node', input.appToken)
    form.append('size', String(input.bytes.byteLength))
    form.append('file', new Blob([input.bytes as BlobPart], { type: input.mime }), input.fileName)

    const { status, body } = await larkFetch(
        `${apiBase()}/drive/v1/medias/upload_all`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
        UPLOAD_TIMEOUT_MS,
    )
    if (status !== 200 || body?.code !== 0 || typeof body?.data?.file_token !== 'string') {
        if (status === 401 || status === 403) cachedToken = null
        throw new LarkApiError('Lark media upload rejected', body?.code ?? null, status)
    }
    return { fileToken: body.data.file_token }
}

/** Test helper: forget the cached tenant token. */
export function resetLarkTokenCache(): void {
    cachedToken = null
}
