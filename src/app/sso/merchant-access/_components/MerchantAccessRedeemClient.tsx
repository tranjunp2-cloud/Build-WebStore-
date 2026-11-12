'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Redeems the link (token in the URL fragment) from the page's own script (POST), so link previews in chat apps cannot use it up.
 * On success the merchant session cookie is set and the browser goes to the dashboard.
 */
export function MerchantAccessRedeemClient() {
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        // The token is in the URL fragment (never sent to the server); drop it from the address bar and history.
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
        window.history.replaceState(null, '', window.location.pathname)
        if (!token) {
            queueMicrotask(() => setFailed(true))
            return
        }
        fetch('/api/auth/merchant-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
                if (res.ok && data?.ok) {
                    window.location.replace('/dashboard')
                } else {
                    setFailed(true)
                }
            })
            .catch(() => setFailed(true))
    }, [])

    if (failed) {
        return (
            <div className="max-w-md space-y-3 text-slate-200">
                <h1 className="text-2xl font-semibold">This link can no longer be used</h1>
                <p className="text-slate-400">
                    Merchant access links work once and expire after 10 minutes. Create a new link from the support page.
                </p>
            </div>
        )
    }

    return <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-label="Signing in" />
}
