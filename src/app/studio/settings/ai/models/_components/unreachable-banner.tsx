'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Banner } from './banner'

/** ai-platform did not answer. The Limits & prices tab does not depend on it, so this page only reports and retries. */
export function UnreachableBanner({ message }: { message: string }) {
    const router = useRouter()
    const [pending, start] = useTransition()
    return (
        <Banner
            tone="danger" title="Could not reach the AI service"
            actions={<button type="button" className="btn btn-sm" disabled={pending} onClick={() => start(() => router.refresh())}>{pending ? 'Trying…' : 'Try again'}</button>}
        >
            {message}. Shops keep using the last saved settings, but nothing here can be read or changed until it answers. Limits &amp; prices still works.
        </Banner>
    )
}
