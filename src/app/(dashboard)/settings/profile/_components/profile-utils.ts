'use client'

import type { PlatformUser } from '@/types/user'

/**
 * Shared pure helpers for profile display (F23 GH-1614).
 * Used by ProfileBanner (staff) and OwnerProfileView (owner).
 */

export function getDisplayName(firstName?: string, lastName?: string, email?: string): string {
    const name = [firstName, lastName].filter(Boolean).join(' ')
    return name || email || 'User'
}

export function getAvatarUrl(avatar: PlatformUser['avatar']): string | null {
    if (!avatar) return null
    if (typeof avatar === 'string') return avatar
    return avatar.url ?? null
}

export function getInitial(firstName?: string, email?: string): string {
    return (firstName?.[0] ?? email?.[0] ?? '?').toUpperCase()
}
