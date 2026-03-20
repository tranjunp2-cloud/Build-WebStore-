'use client'

import { Toaster } from 'sonner'

export function AuthToaster() {
    return (
        <Toaster
            position="top-center"
            toastOptions={{
                style: {
                    background: '#1E293B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#F1F5F9',
                },
            }}
        />
    )
}
