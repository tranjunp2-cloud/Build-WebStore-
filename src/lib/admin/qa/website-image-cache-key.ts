import { createHash } from 'node:crypto';
export function websiteImageCacheKey(source: string, media: { id: string | number; updatedAt?: unknown }, destination: string) {
  return createHash('sha256').update(JSON.stringify(['image-v1', source, media.id, media.updatedAt, destination])).digest('hex');
}
