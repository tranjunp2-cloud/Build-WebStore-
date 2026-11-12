'use client'

import { useEffect, useState } from 'react'
import type { FeedbackType } from './types'

export const AVAILABILITY_ENDPOINT = '/api/v1/feedback/availability'

type Availability = { enabled: boolean; types: FeedbackType[] }

/** Server decides whether the feedback window is open and which types this store may use. Hidden until known. */
export function useFeedbackAvailability(): Availability {
    const [state, setState] = useState<Availability>({ enabled: false, types: [] })

    useEffect(() => {
        let cancelled = false
        fetch(AVAILABILITY_ENDPOINT)
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
                if (cancelled || !body || typeof body.enabled !== 'boolean' || !Array.isArray(body.types)) return
                setState({ enabled: body.enabled, types: body.types })
            })
            .catch(() => { /* stays hidden: feedback is optional UI */ })
        return () => { cancelled = true }
    }, [])

    return state
}
