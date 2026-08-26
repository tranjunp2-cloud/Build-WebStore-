import { Mail } from 'lucide-react'
import type { CustomerSource } from '../_lib/customer-record'

function getInitials(name: string | null, email: string): string {
    if (name) {
        const parts = name.trim().split(/\s+/)
        return parts.length >= 2
            ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
            : parts[0]!.slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
}

type Props = {
    name: string | null
    email: string
    source: CustomerSource
    size?: number
}

export function CustomerAvatar({ name, email, source, size = 40 }: Props) {
    return (
        <div
            className="flex items-center justify-center shrink-0 rounded-[8px]"
            style={{ width: size, height: size, background: 'var(--dash-secondary-bg)' }}
        >
            {source === 'newsletter' ? (
                <Mail style={{ width: Math.round(size * 0.53), height: Math.round(size * 0.53), color: 'var(--dash-accent)' }} />
            ) : (
                <span
                    className="font-extrabold select-none"
                    style={{ fontSize: Math.round(size * 0.4), color: 'var(--dash-accent)', fontFamily: 'Manrope, sans-serif' }}
                >
                    {getInitials(name, email)}
                </span>
            )}
        </div>
    )
}
