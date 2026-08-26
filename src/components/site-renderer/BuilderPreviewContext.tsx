'use client'

import { createContext, useContext, type ReactNode } from 'react'

const BuilderPreviewContext = createContext(false)

export function BuilderPreviewProvider({ value, children }: { value: boolean; children: ReactNode }) {
    return <BuilderPreviewContext.Provider value={value}>{children}</BuilderPreviewContext.Provider>
}

export function useIsBuilderPreview() {
    return useContext(BuilderPreviewContext)
}
