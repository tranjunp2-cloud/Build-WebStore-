/**
 * Block preview layout — minimal wrapper for iframe embedding.
 * Route groups nest inside root `src/app/layout.tsx`, so use <div> (not <html>/<body>).
 * Robots noindex is set on the page via `metadata` export.
 */
import '@/app/globals.css'

export default function BlockPreviewLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <div className="preview-body">{children}</div>
}
