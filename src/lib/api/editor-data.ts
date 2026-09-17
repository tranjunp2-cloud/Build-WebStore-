import { queryOptions } from '@tanstack/react-query'

export class EditorDataRequestError extends Error {
    constructor(
        readonly status: number,
        message = `Failed to load editor data (${status})`,
    ) {
        super(message)
        this.name = 'EditorDataRequestError'
    }
}

type EditorDataRequest = {
    siteId: string
    pageId?: string | null
}

export function editorDataQueryKey({ siteId, pageId }: EditorDataRequest) {
    return ['editor-data', siteId, pageId || 'homepage'] as const
}

export function editorDataQueryOptions<TData>({ siteId, pageId }: EditorDataRequest) {
    return queryOptions({
        queryKey: editorDataQueryKey({ siteId, pageId }),
        staleTime: 0,
        retry: false,
        queryFn: async ({ signal }): Promise<TData> => {
            const url = new URL(`/api/sites/${siteId}/editor-data`, window.location.origin)
            if (pageId) url.searchParams.set('pageId', pageId)

            const response = await fetch(url.toString(), {
                credentials: 'include',
                cache: 'no-store',
                signal,
            })
            if (!response.ok) throw new EditorDataRequestError(response.status)
            return await response.json() as TData
        },
    })
}
