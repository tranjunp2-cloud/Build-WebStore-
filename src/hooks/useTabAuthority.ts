'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const CHANNEL_NAME = 'primeweb-editor-tab'

type TabMessage = {
    type: 'CLAIM_AUTHORITY' | 'YIELD_AUTHORITY'
    siteId: string
    tabId: string
}

export function useTabAuthority(siteId: string) {
    const tabIdRef = useRef(`tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    const [isMaster, setIsMaster] = useState(true)
    const channelRef = useRef<BroadcastChannel | null>(null)

    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return

        const channel = new BroadcastChannel(CHANNEL_NAME)
        channelRef.current = channel

        // Claim authority on mount
        channel.postMessage({
            type: 'CLAIM_AUTHORITY',
            siteId,
            tabId: tabIdRef.current,
        } satisfies TabMessage)

        channel.onmessage = (e: MessageEvent<TabMessage>) => {
            const msg = e.data
            if (msg.siteId !== siteId) return

            if (msg.type === 'CLAIM_AUTHORITY' && msg.tabId !== tabIdRef.current) {
                // Another tab is claiming authority — yield
                setIsMaster(false)
            }

            if (msg.type === 'YIELD_AUTHORITY' && msg.tabId !== tabIdRef.current) {
                // Another tab yielded — we can reclaim if needed
            }
        }

        return () => {
            channel.postMessage({
                type: 'YIELD_AUTHORITY',
                siteId,
                tabId: tabIdRef.current,
            } satisfies TabMessage)
            channel.close()
            channelRef.current = null
        }
    }, [siteId])

    const reclaimAuthority = useCallback(() => {
        setIsMaster(true)
        channelRef.current?.postMessage({
            type: 'CLAIM_AUTHORITY',
            siteId,
            tabId: tabIdRef.current,
        } satisfies TabMessage)
    }, [siteId])

    return { isMaster, reclaimAuthority, tabId: tabIdRef.current }
}
