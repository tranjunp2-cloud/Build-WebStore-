import { MerchantAccessRedeemClient } from './_components/MerchantAccessRedeemClient'

export const metadata = { robots: { index: false, follow: false } }

/** Landing page of a one-time merchant CMS access link; the client redeems it and opens the dashboard. */
export default function MerchantAccessPage() {
    return (
        <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#0B1120] px-6 text-center">
            <MerchantAccessRedeemClient />
        </div>
    )
}
