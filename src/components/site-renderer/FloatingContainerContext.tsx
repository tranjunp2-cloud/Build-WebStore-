'use client'

import { createContext, useContext, type ReactNode } from 'react'

const FloatingContainerContext = createContext(false)

export function FloatingContainerProvider({ value, children }: { value: boolean; children: ReactNode }) {
    return <FloatingContainerContext.Provider value={value}>{children}</FloatingContainerContext.Provider>
}

/** Returns true when the block is rendered inside a SiteRenderer-managed floating stack container. */
export const useInFloatingContainer = () => useContext(FloatingContainerContext)
