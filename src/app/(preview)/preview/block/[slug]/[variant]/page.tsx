/**
 * Block variant SSR preview page.
 * Renders a single block in isolation — no app chrome, no nav, no footer.
 * Embedded as <iframe> in variant-gallery.tsx and variant-zoom-modal.tsx.
 *
 * Routing:
 *   /preview/block/[slug]/[variant]
 *   e.g. /preview/block/hero/centered
 *
 * Caching: NONE — force-dynamic so block code edits reflect immediately.
 */
import { notFound } from 'next/navigation'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import { buildDemoContent, requiresLiveData } from '@/lib/admin/block-preview-demo-content'
import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ slug: string; variant: string }> }

export default async function BlockPreviewPage({ params }: Params) {
  const { slug, variant } = await params

  // 1. Validate slug exists in registry
  const blockMeta = getBlockBySlug(slug)
  if (!blockMeta) notFound()

  // 2. Validate variant is in the block's variant list
  if (!blockMeta.variants.includes(variant)) notFound()

  // 3. Live-data blocks get a friendly fallback (not 404)
  if (requiresLiveData(slug)) {
    return (
      <div className="preview-fallback">
        <div className="preview-fallback-icon">📊</div>
        <div className="preview-fallback-title">{blockMeta.name}</div>
        <div className="preview-fallback-variant">{variant}</div>
        <div className="preview-fallback-desc">
          Preview requires live data — not available in isolated preview.
        </div>
      </div>
    )
  }

  // 4. Build neutral demo content
  const content = buildDemoContent(slug, variant)
  if (!content) notFound()

  // 5. Resolve block component from registry
  const Component = blockRegistry.getComponent(slug)
  if (!Component) notFound()

  // 6. Apply neutral default theme (no dark toggle per locked decision)
  const theme = resolveTheme({})
  const themeCSS = generateThemeCSS(theme)

  return (
    <>
      {/* Inject theme CSS custom properties scoped to :root */}
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />

      {/* Preview-specific layout styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .preview-body { margin: 0; padding: 0; overflow: hidden; background: var(--background, #ffffff); }
          .preview-fallback {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            min-height: 100vh; padding: 40px;
            color: #71717a; text-align: center; font-family: system-ui, sans-serif;
          }
          .preview-fallback-icon { font-size: 48px; margin-bottom: 16px; }
          .preview-fallback-title { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 4px; }
          .preview-fallback-variant { font-size: 12px; font-family: monospace; color: #9ca3af; margin-bottom: 12px; }
          .preview-fallback-desc { font-size: 13px; max-width: 360px; line-height: 1.5; }
        `,
      }} />

      {/* Block render — wrapped in error boundary to surface SSR crashes gracefully */}
      <BlockErrorBoundary blockType={slug}>
        <Component
          block={content}
          theme={theme}
          isEditor={false}
          isPreview={true}
        />
      </BlockErrorBoundary>
    </>
  )
}
