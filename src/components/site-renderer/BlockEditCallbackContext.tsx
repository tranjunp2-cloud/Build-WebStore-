'use client'

import { createContext, useContext, type ReactNode } from 'react'

type BlockEditCallbackValue = {
    blockIndex: number
    onFieldChange: (field: string, value: unknown) => void
} | null

const BlockEditCallbackContext = createContext<BlockEditCallbackValue>(null)

export function BlockEditCallbackProvider({ value, children }: { value: BlockEditCallbackValue; children: ReactNode }) {
    return <BlockEditCallbackContext.Provider value={value}>{children}</BlockEditCallbackContext.Provider>
}

export function useBlockEditCallback() {
    return useContext(BlockEditCallbackContext)
}
