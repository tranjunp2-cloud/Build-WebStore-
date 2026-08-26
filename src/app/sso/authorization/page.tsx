import { SsoAuthorizationClient } from './_components/SsoAuthorizationClient'

export const dynamic = 'force-dynamic'

export default async function SsoAuthorizationPage({
    searchParams,
}: {
    searchParams: Promise<{ v2_token?: string; redirect_url?: string | string[] }>
}) {
    const { v2_token, redirect_url } = await searchParams
    const redirectUrl = typeof redirect_url === 'string' ? redirect_url : undefined

    return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#0B1120] m-0 p-0 relative">
            <SsoAuthorizationClient v2Token={v2_token} redirectUrl={redirectUrl} />
        </div>
    )
}
