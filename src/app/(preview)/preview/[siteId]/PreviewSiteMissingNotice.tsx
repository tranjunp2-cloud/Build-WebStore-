'use client'

import { useEffect } from 'react'

/**
 * Rendered inside the editor/builder iframe when the requested site no longer
 * exists (e.g. a stale siteId persisted in the builder's localStorage points at
 * a deleted/reseeded row). Notifies the parent so it can clear the stale id and
 * recover, instead of trapping the user on a bare 404. Renders a minimal notice.
 */
export function PreviewSiteMissingNotice({ siteId }: { siteId: string }) {
    useEffect(() => {
        try {
            window.parent?.postMessage(
                { type: 'PREVIEW_SITE_NOT_FOUND', siteId },
                window.location.origin,
            )
        } catch {
            /* cross-origin or no parent — nothing to recover */
        }
    }, [siteId])

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="p-8 text-center text-slate-500 text-sm">
                This site is no longer available. Refreshing your workspace…
            </div>
        </div>
    )
}
