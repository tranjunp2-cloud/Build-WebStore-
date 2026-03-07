import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 * Usage: cn('px-4 py-2', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format relative time (e.g., "2 phút trước")
 */
export function formatRelativeTime(date: Date | string): string {
    const now = new Date()
    const target = new Date(date)
    const diffMs = now.getTime() - target.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return 'Vừa xong'
    if (diffMin < 60) return `${diffMin} phút trước`
    if (diffHour < 24) return `${diffHour} giờ trước`
    if (diffDay < 7) return `${diffDay} ngày trước`
    return target.toLocaleDateString('vi-VN')
}

/**
 * Format storage size (bytes to human readable)
 */
export function formatStorage(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
    return `${(bytes / 1073741824).toFixed(1)} GB`
}
