import type { MappingContext, Row } from '../contracts'
const platforms: Record<string, string> = {
  'facebook.com': 'facebook', 'www.facebook.com': 'facebook', 'm.facebook.com': 'facebook',
  'instagram.com': 'instagram', 'www.instagram.com': 'instagram',
  'twitter.com': 'twitter', 'www.twitter.com': 'twitter', 'x.com': 'twitter', 'www.x.com': 'twitter',
  'linkedin.com': 'linkedin', 'www.linkedin.com': 'linkedin',
  'youtube.com': 'youtube', 'www.youtube.com': 'youtube', 'youtu.be': 'youtube',
  'tiktok.com': 'tiktok', 'www.tiktok.com': 'tiktok',
}
export function mapSocialLinks(ctx: MappingContext, store: Row): Record<string, string> {
  const out: Record<string, string> = {}
  if (!store.social_channel?.trim()) return out
  let entries: unknown
  try { entries = JSON.parse(store.social_channel) } catch { ctx.issue('SOCIAL_CHANNEL_INVALID', 'stores', store.id, 'social_channel', 'warning', 'SOURCE_ENTRY_OMITTED'); return out }
  if (!Array.isArray(entries)) { ctx.issue('SOCIAL_CHANNEL_INVALID', 'stores', store.id, 'social_channel', 'warning', 'SOURCE_ENTRY_OMITTED'); return out }
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.url !== 'string') { ctx.issue('SOCIAL_CHANNEL_INVALID', 'stores', store.id, 'social_channel', 'warning', 'SOURCE_ENTRY_OMITTED'); continue }
    let url: URL
    try { url = new URL(entry.url) } catch { ctx.issue('SOCIAL_CHANNEL_INVALID', 'stores', store.id, 'social_channel', 'warning', 'SOURCE_ENTRY_OMITTED'); continue }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) { ctx.issue('SOCIAL_CHANNEL_INVALID', 'stores', store.id, 'social_channel', 'warning', 'SOURCE_ENTRY_OMITTED'); continue }
    const host = url.hostname.toLowerCase()
    const platform = Object.hasOwn(platforms, host) ? platforms[host] : undefined
    if (!platform) { ctx.issue('SOCIAL_CHANNEL_METADATA_OMITTED', 'stores', store.id, 'social_channel', 'warning', 'UNSUPPORTED_PLATFORM'); continue }
    if (out[platform] !== undefined) { ctx.issue('SOCIAL_CHANNEL_METADATA_OMITTED', 'stores', store.id, 'social_channel', 'warning', 'DUPLICATE_PLATFORM_FIRST_RETAINED'); continue }
    out[platform] = entry.url
  }
  ctx.contribute('stores', store, ['social_channel'], 'sites[].socialLinks', 'MASTER-4-SOCIAL-SUPPORTED-FIELDS')
  ctx.issue('SOCIAL_CHANNEL_METADATA_OMITTED', 'stores', store.id, 'social_channel', 'warning', 'PW2_SUPPORTED_FIELDS_ONLY')
  return out
}
