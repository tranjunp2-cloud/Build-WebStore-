import { PageHead } from '../_components/page-head'
import { SkeletonCard, SkeletonTiers } from '../_components/skeletons'

export default function Loading() {
    return (
        <>
            <PageHead title="Overview" sub="Loading…" />
            <SkeletonTiers />
            <SkeletonCard rows={4} label="Loading providers" />
        </>
    )
}
