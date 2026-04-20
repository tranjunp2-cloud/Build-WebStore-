import { renderHarnessFixture } from '../harness-render'

export const dynamic = 'force-dynamic'

export default async function HarnessSubPage({
    params,
}: {
    params: Promise<{ fixtureId: string; slug: string }>
}) {
    const { fixtureId, slug } = await params
    return renderHarnessFixture(fixtureId, slug)
}
