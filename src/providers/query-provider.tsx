'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface QueryProviderProps {
    children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000,
                gcTime: 10 * 60 * 1000,
                refetchOnWindowFocus: false,
                retry: 1,
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
