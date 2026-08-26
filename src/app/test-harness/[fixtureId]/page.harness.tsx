import { renderHarnessFixture } from './harness-render'

export const dynamic = 'force-dynamic'

export default async function HarnessFixturePage({
    params,
}: {
    params: Promise<{ fixtureId: string }>
}) {
    const { fixtureId } = await params
    return renderHarnessFixture(fixtureId)
}
