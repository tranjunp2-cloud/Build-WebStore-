'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { MerchantAccountSummary } from '@/lib/support/find-merchant-accounts'

type LinkState = { userId: number; url: string; expiresAt: string; autoCopied: boolean } | null

/**
 * Search a merchant by email or company, then create a one-time link that opens their CMS without OTP.
 * The link is copied automatically. It must be opened in a private window: in this browser it would
 * overwrite the admin's own session cookie.
 */
export function MerchantAccessClient({ showHeading = true }: { showHeading?: boolean }) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<MerchantAccountSummary[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<number | null>(null)
    const [link, setLink] = useState<LinkState>(null)
    const [copied, setCopied] = useState(false)

    async function search(e: FormEvent) {
        e.preventDefault()
        setError(null)
        setLink(null)
        try {
            const res = await fetch(`/api/admin/merchant-access?q=${encodeURIComponent(query.trim())}`)
            if (!res.ok) {
                setError('Search failed. Please sign in again or try later.')
                return
            }
            const body = (await res.json()) as { data: MerchantAccountSummary[] }
            setResults(body.data)
        } catch {
            setError('Network error. Please try again.')
        }
    }

    async function writeClipboard(text: string): Promise<boolean> {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch {
            // Clipboard blocked (permission / insecure context): the Copy button stays as the fallback.
            return false
        }
    }

    async function createLink(userId: number) {
        setBusyId(userId)
        setError(null)
        setCopied(false)
        try {
            const res = await fetch('/api/admin/merchant-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            })
            const body = (await res.json().catch(() => null)) as { data?: { url: string; expiresAt: string }; error?: string } | null
            if (!res.ok || !body?.data) {
                setError(body?.error ?? 'Could not create the link.')
                return
            }
            const autoCopied = await writeClipboard(body.data.url)
            setCopied(autoCopied)
            setLink({ userId, ...body.data, autoCopied })
            router.refresh() // the Recent access table (Studio page) picks up the new row
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setBusyId(null)
        }
    }

    async function copyLink() {
        if (link) setCopied(await writeClipboard(link.url))
    }

    return (
        <div className="space-y-6">
            {showHeading && <h1 className="text-2xl font-semibold">Merchant CMS access</h1>}
            <p className="text-sm text-slate-600">
                Open a merchant&apos;s CMS to build their site, without their OTP. Each link works once, expires after
                10 minutes, and is logged with your account.
            </p>

            <form onSubmit={search} className="flex gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Merchant email or company name (min. 3 characters)"
                    aria-label="Merchant email or company name"
                    className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <button
                    type="submit"
                    disabled={query.trim().length < 3}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                    Search
                </button>
            </form>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            {results && results.length === 0 && <p className="text-sm text-slate-600">No merchant account found.</p>}

            {results && results.length > 0 && (
                <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-slate-900">
                    {results.map((r) => (
                        <li key={r.id} className="space-y-3 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{r.email}</p>
                                    <p className="truncate text-sm text-slate-600">
                                        {r.tenants.length === 0
                                            ? 'No store yet'
                                            : r.tenants.map((t) => `${t.name || 'Unnamed store'}${t.status ? ` (${t.status})` : ''}`).join(', ')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => createLink(r.id)}
                                    disabled={busyId !== null}
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
                                >
                                    {busyId === r.id ? 'Creating…' : 'Create login link'}
                                </button>
                            </div>
                            {link?.userId === r.id && (
                                <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm">
                                    <p className="font-medium text-amber-900">
                                        {link.autoCopied ? 'Link copied. ' : ''}Open it in a private window (Ctrl+Shift+N, or ⌘⇧N on Mac).
                                    </p>
                                    <p className="text-amber-800">
                                        In this browser the link would replace your own admin session with the merchant&apos;s.
                                    </p>
                                    <div className="flex gap-2">
                                        <input readOnly value={link.url} aria-label="Login link" className="flex-1 rounded border border-amber-200 bg-white px-2 py-1 font-mono text-xs text-slate-900" />
                                        <button type="button" onClick={copyLink} className="rounded bg-amber-900 px-3 py-1 text-xs font-medium text-white">
                                            {copied ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="text-amber-800">Expires at {new Date(link.expiresAt).toLocaleTimeString()}. Do not paste it in chat.</p>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
