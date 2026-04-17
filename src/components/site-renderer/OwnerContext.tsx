'use client'

import { createContext, useContext, type ReactNode } from 'react'

const OwnerContext = createContext(false)

export function OwnerProvider({ value, children }: { value: boolean; children: ReactNode }) {
    return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>
}

export function useIsOwner() {
    return useContext(OwnerContext)
}
