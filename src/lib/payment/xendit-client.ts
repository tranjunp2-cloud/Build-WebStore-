const XENDIT_BASE_URL = 'https://api.xendit.co'

export class XenditError extends Error {
    constructor(
        public code: 'XENDIT_CONFIG_ERROR' | 'XENDIT_API_ERROR',
        message: string,
        public status?: number,
        public raw?: unknown,
    ) {
        super(message)
        this.name = 'XenditError'
    }
}

function authHeader(): string {
    const key = process.env.XENDIT_SECRET_KEY
    if (!key) {
        throw new XenditError('XENDIT_CONFIG_ERROR', 'XENDIT_SECRET_KEY is not set')
    }
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}

export async function xenditFetch<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; forUserId?: string } = { method: 'GET' },
): Promise<T> {
    const headers: Record<string, string> = {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
    }
    if (init.forUserId) headers['for-user-id'] = init.forUserId

    const res = await fetch(`${XENDIT_BASE_URL}${path}`, {
        method: init.method,
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
    })

    const text = await res.text()
    const json = text ? JSON.parse(text) : {}

    if (!res.ok) {
        throw new XenditError(
            'XENDIT_API_ERROR',
            `Xendit ${init.method} ${path} failed: ${res.status} ${json?.error_code ?? ''} ${json?.message ?? ''}`.trim(),
            res.status,
            json,
        )
    }
    return json as T
}
