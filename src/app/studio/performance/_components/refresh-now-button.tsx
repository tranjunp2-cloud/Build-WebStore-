/**
 * refresh-now-button.tsx
 * Triggers router.refresh() + appends cache-bust ?_=timestamp to force
 * Next.js to bypass the 5-min revalidate cache for this navigation.
 */
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

export function RefreshNowButton() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = useCallback(() => {
    setSpinning(true)
    const next = new URLSearchParams(sp.toString())
    next.set('_', String(Date.now()))
    router.push(`${pathname}?${next.toString()}`)
    router.refresh()
    setTimeout(() => setSpinning(false), 1200)
  }, [router, pathname, sp])

  return (
    <button
      onClick={handleRefresh}
      title="Bypass 5-min cache and reload metrics"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg-elev)',
        color: 'var(--text-2)',
        fontSize: 12,
        fontWeight: 500,
        cursor: spinning ? 'not-allowed' : 'pointer',
        opacity: spinning ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
      disabled={spinning}
    >
      <RefreshCw
        size={13}
        style={{
          transition: 'transform 0.6s',
          transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
        }}
      />
      Refresh
    </button>
  )
}
