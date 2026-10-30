'use client'

import { useRef, useState } from 'react'
import type { SettingsView } from '@/lib/admin/ai-providers/types'

/** Server data kept in state: replaced by every write's answer, and by a fresh server render (router.refresh). */
export function useSynced<T>(initial: T) {
    const [value, setValue] = useState(initial)
    const seen = useRef(initial)
    if (seen.current !== initial) {
        seen.current = initial
        setValue(initial)
    }
    return [value, setValue] as const
}

export const useViewState = (initial: SettingsView) => useSynced<SettingsView>(initial)
