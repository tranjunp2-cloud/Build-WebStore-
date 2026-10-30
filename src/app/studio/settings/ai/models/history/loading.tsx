import { PageHead } from '../_components/page-head'
import { SkeletonCard } from '../_components/skeletons'

export default function Loading() {
    return (
        <>
            <PageHead title="History" sub="Loading…" />
            <SkeletonCard rows={4} label="Loading" />
        </>
    )
}
