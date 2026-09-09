'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { usePathname, useRouter } from 'next/navigation'
import type { Template } from '@/components/frontend/TemplateCard'
import type { SubscriptionErrorStrings } from '@/lib/ui/resolve-api-error'
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import {
    templateCardArrayResponseSchema,
    type TemplateSearchRequest,
} from '@/lib/validations/template-search'

interface ApplyTemplateInput {
    templateId: string
    siteId: string
}

interface ApplyTemplateResponse {
    siteId?: string | number
    unmatchedBlocks?: string[]
}

class TemplateRequestError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly responseBody: unknown,
    ) {
        super(message)
        this.name = 'TemplateRequestError'
    }
}

function useLoginRedirect(): () => void {
    const pathname = usePathname()
    const router = useRouter()

    return () => {
        const search = typeof window === 'undefined' ? '' : window.location.search
        const returnUrl = `${pathname}${search}`
        router.replace(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
    }
}

async function readResponseBody(response: Response): Promise<unknown> {
    return response.json().catch(() => null)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function requireTemplateArray(value: unknown, body: unknown, fallback: string): Template[] {
    const parsed = templateCardArrayResponseSchema.safeParse(value)
    if (!parsed.success) {
        throw new TemplateRequestError(`${fallback}: invalid server response`, 502, body)
    }
    return parsed.data
}

function templatesFromListResponse(body: unknown): Template[] {
    if (!isRecord(body)) {
        throw new TemplateRequestError('Failed to load templates: invalid server response', 502, body)
    }
    if (Array.isArray(body.docs)) return requireTemplateArray(body.docs, body, 'Failed to load templates')
    if (Array.isArray(body.results)) return requireTemplateArray(body.results, body, 'Failed to load templates')
    if (isRecord(body.data)) {
        return requireTemplateArray(body.data.templates, body, 'Failed to load templates')
    }
    throw new TemplateRequestError('Failed to load templates: invalid server response', 502, body)
}

function templatesFromSearchResponse(body: unknown): Template[] {
    if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
        throw new TemplateRequestError('Failed to search templates: invalid server response', 502, body)
    }
    return requireTemplateArray(body.data.templates, body, 'Failed to search templates')
}

function applyResultFromResponse(body: unknown): ApplyTemplateResponse {
    // Preserve the existing Apply flow: successful responses may omit metadata;
    // the editor already owns the selected template name and target site ID.
    if (!isRecord(body)) return {}
    return {
        siteId: typeof body.siteId === 'string' || typeof body.siteId === 'number' ? body.siteId : undefined,
        unmatchedBlocks: Array.isArray(body.unmatchedBlocks)
            ? body.unmatchedBlocks.filter((block): block is string => typeof block === 'string')
            : undefined,
    }
}

function genericErrorMessage(body: unknown, fallback: string): string {
    if (!body || typeof body !== 'object') return fallback
    const error = (body as { error?: unknown }).error
    if (typeof error === 'string') return error
    if (error && typeof error === 'object') {
        const message = (error as { message?: unknown }).message
        if (typeof message === 'string') return message
    }
    return fallback
}

async function assertResponse(
    response: Response,
    redirectToLogin: () => void,
    fallback: string,
): Promise<unknown> {
    const body = await readResponseBody(response)
    if (response.status === 401) redirectToLogin()
    if (!response.ok) {
        throw new TemplateRequestError(
            genericErrorMessage(body, fallback),
            response.status,
            body,
        )
    }
    return body
}

export function useTemplateList(isOpen: boolean) {
    const redirectToLogin = useLoginRedirect()

    return useQuery<Template[], Error>({
        queryKey: ['templates', 'list'],
        enabled: isOpen,
        queryFn: async ({ signal }) => {
            const response = await fetch('/api/templates/list?limit=100', {
                credentials: 'include',
                signal,
            })
            const body = await assertResponse(response, redirectToLogin, 'Failed to load templates')
            return templatesFromListResponse(body)
        },
        retry: false,
    })
}

export function useTemplateSearch(request: TemplateSearchRequest | null, isOpen: boolean) {
    const redirectToLogin = useLoginRedirect()

    return useQuery<Template[], Error>({
        queryKey: ['templates', 'search', request?.query ?? '', request?.locale ?? ''],
        enabled: isOpen && request !== null,
        queryFn: async ({ signal }) => {
            if (!request) return []
            const response = await fetch('/api/templates/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(request),
                signal,
            })
            const body = await assertResponse(response, redirectToLogin, 'Failed to search templates')
            return templatesFromSearchResponse(body)
        },
        retry: false,
    })
}

export function useApplyTemplate(subscriptionErrors: SubscriptionErrorStrings) {
    const redirectToLogin = useLoginRedirect()

    return useMutation<ApplyTemplateResponse, Error, ApplyTemplateInput>({
        mutationFn: async ({ templateId, siteId }) => {
            const response = await fetch('/api/ai/apply-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ templateId, siteId }),
            })
            const body = await readResponseBody(response)
            if (response.status === 401) redirectToLogin()
            if (!response.ok) {
                throw new TemplateRequestError(
                    resolveApiError(body, `Server returned ${response.status}`, subscriptionErrors),
                    response.status,
                    body,
                )
            }
            return applyResultFromResponse(body)
        },
    })
}
