import { PageHead } from '../_components/page-head'
import { SkeletonCard } from '../_components/skeletons'

export default function Loading() {
    return (
        <>
            <PageHead title="Providers" sub="Loading…" />
            <SkeletonCard rows={3} label="Loading providers" />
            <SkeletonCard rows={3} label="Loading endpoints" />
        </>
    )
}
