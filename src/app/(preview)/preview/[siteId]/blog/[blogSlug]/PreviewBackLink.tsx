'use client'

import { useRouter } from 'next/navigation'

interface PreviewBackLinkProps {
    label: string
    primaryColor: string
}

export function PreviewBackLink({ label, primaryColor }: PreviewBackLinkProps) {
    const router = useRouter()
    return (
        <button
            onClick={() => router.back()}
            className="text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: primaryColor }}
        >
            {label}
        </button>
    )
}
