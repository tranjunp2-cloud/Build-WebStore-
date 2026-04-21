/**
 * Block preview layout — minimal shell for iframe embedding.
 * Bypasses app nav/footer chrome. Imports globals.css for Tailwind + CSS vars.
 * noindex/nofollow prevents search indexing of preview routes.
 */
import '@/app/globals.css'

export default function BlockPreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className="preview-body">
        {children}
      </body>
    </html>
  )
}
