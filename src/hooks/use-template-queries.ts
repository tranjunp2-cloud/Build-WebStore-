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

/** The template catalogue changes rarely: a picker opened again within 5 min reuses what it loaded. */
const TEMPLATE_STALE_TIME = 5 * 60 * 1000

interface ApplyTemplateInput {
    templateId: string
    siteId: string
    pageId?: string
}

export interface AppliedTemplateState {
    site: {
        theme: Record<string, unknown>
        headerBlock: Record<string, unknown> | null
        footerBlock: Record<string, unknown> | null
        globalBlocks: Record<string, unknown> | null
    }
    page: { id: string | number; layout: Record<string, unknown>[] } | null
}

interface ApplyTemplateResponse {
    siteId: string | number
    unmatchedBlocks?: string[]
    appliedState?: AppliedTemplateState
    /** the editor draft revision after the apply (the applying tab adopts it) */
    draftVersion?: string
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
    if (!isRecord(body) || body.success !== true || !isRecord(body.data)
        || (typeof body.data.siteId !== 'string' && typeof body.data.siteId !== 'number')) {
        throw new TemplateRequestError('Failed to apply template: invalid server response', 502, body)
    }
    const data = body.data
    return {
        siteId: data.siteId as string | number,
        unmatchedBlocks: Array.isArray(data.unmatchedBlocks)
            ? data.unmatchedBlocks.filter((block): block is string => typeof block === 'string')
            : undefined,
        appliedState: data.appliedState as AppliedTemplateState | undefined,
        draftVersion: typeof data.draftVersion === 'string' ? data.draftVersion : undefined,
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
        staleTime: TEMPLATE_STALE_TIME,
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
        staleTime: TEMPLATE_STALE_TIME,
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

export function useTemplateForSwap(templateId: string | null) {
    const redirectToLogin = useLoginRedirect()

    return useQuery<Template, Error>({
        queryKey: ['templates', 'swap-detail', templateId],
        enabled: templateId !== null,
        staleTime: TEMPLATE_STALE_TIME,
        retry: false,
        queryFn: async ({ signal }) => {
            const response = await fetch(`/api/templates/list?templateId=${encodeURIComponent(templateId!)}`, {
                credentials: 'include', signal,
            })
            const body = await assertResponse(response, redirectToLogin, 'Failed to load template')
            const template = templatesFromListResponse(body).find(candidate => candidate.id === templateId)
            if (!template?.swapData) {
                throw new TemplateRequestError('Failed to load template: missing template layout', 502, body)
            }
            return template
        },
    })
}

export function useApplyTemplate(subscriptionErrors: SubscriptionErrorStrings) {
    const redirectToLogin = useLoginRedirect()

    return useMutation<ApplyTemplateResponse, Error, ApplyTemplateInput>({
        mutationFn: async ({ templateId, siteId, pageId }) => {
            const response = await fetch('/api/ai/apply-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ templateId, siteId, pageId }),
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
