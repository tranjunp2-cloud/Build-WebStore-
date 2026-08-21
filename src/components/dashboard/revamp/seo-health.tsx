import { SeoHealthClient } from './seo-health-client'

export function SeoHealth({ siteId }: { siteId: string }) {
    return <SeoHealthClient siteId={siteId} />
}
