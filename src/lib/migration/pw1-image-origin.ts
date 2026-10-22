/** PW1 keeps merchant uploads on DigitalOcean Spaces (prod, dev and per-project buckets). Only those are copied into destination media; an image hotlinked from another site stays exactly as the merchant wrote it. */
export function isPw1StorageUrl(url: string): boolean {
    try { return new URL(url).hostname.toLowerCase().endsWith('.digitaloceanspaces.com') } catch { return false }
}
