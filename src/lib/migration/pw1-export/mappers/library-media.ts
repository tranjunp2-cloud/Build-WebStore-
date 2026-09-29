import { live, ref, type MappingContext } from '../contracts'
import { compareIds, safeUrl, timestamp } from '../primitives'
export const MEDIA_METADATA_RULE = 'MASTER-10-MEDIA-SOURCE-METADATA'
export function mapLibraryMedia(ctx: MappingContext): void {
  for (const row of ctx.rows('medias', true).sort((a,b) => compareIds(a.id!,b.id!))) {
    const reason = !live(row) ? 'DELETED' : row.type === '2' ? 'FOLDER' : !row.url?.trim() ? 'EMPTY_URL' : undefined
    if (reason) { ctx.issue('MEDIA_SOURCE_ONLY', 'medias', row.id, undefined, 'warning', reason); continue }
    if (row.type !== '1') { ctx.issue('MEDIA_TYPE_UNVERIFIED', 'medias', row.id, 'type'); continue }
    try { safeUrl(row.url) } catch { ctx.issue('MEDIA_URL_INVALID', 'medias', row.id, 'url'); continue }
    const dates: Record<string,string> = {}
    try {
      if (row.created_at) dates.createdAt = timestamp(row.created_at, ctx.config)
      if (row.updated_at) dates.updatedAt = timestamp(row.updated_at, ctx.config)
    } catch { ctx.issue('MEDIA_TIMESTAMP_INVALID', 'medias', row.id); continue }
    ctx.output.media.push({ _ref: ref('media', 'medias', row.id!), url: row.url!, sourceUrl: row.url!, alt: row.name?.trim() || `Media ${row.id}`, ...dates })
    ctx.contribute('medias', row, ['name', 'url', 'created_at', 'updated_at'].filter(field => Object.hasOwn(row,field)), 'media[]', 'MASTER-10-EXTERNAL-LIBRARY-MEDIA')
  }
}
