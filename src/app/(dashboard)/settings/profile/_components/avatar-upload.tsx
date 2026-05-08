'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import type { PlatformUser } from '@/types/user'
import { AVATAR_MAX_BYTES, AVATAR_ALLOWED_MIME } from '@/lib/profile/schemas'
import { useUserAvatar } from '@/providers/UserAvatarContext'

type Props = {
    currentAvatar: PlatformUser['avatar']
    onUserUpdate: (partial: Partial<PlatformUser>) => void
}

export function AvatarUpload({ currentAvatar, onUserUpdate }: Props) {
    const { t } = useI18n()
    const { avatarUrl: prevHeaderUrl, setAvatarUrl } = useUserAvatar()
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

    async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > AVATAR_MAX_BYTES) {
            toast.error(t.profile.errors.avatarTooLarge)
            e.target.value = ''
            return
        }
        if (!AVATAR_ALLOWED_MIME.includes(file.type as typeof AVATAR_ALLOWED_MIME[number])) {
            toast.error(t.profile.errors.avatarWrongType)
            e.target.value = ''
            return
        }

        const previewUrl = URL.createObjectURL(file)
        onUserUpdate({ avatar: { url: previewUrl } })
        setAvatarUrl(previewUrl)
        setUploading(true)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/users/me/avatar', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            })

            if (!res.ok) throw new Error('upload_failed')

            const data = await res.json() as { url: string }
            onUserUpdate({ avatar: { url: data.url } })
            setAvatarUrl(data.url)
            toast.success(t.profile.banner.uploadAvatar)
        } catch {
            onUserUpdate({ avatar: currentAvatar })
            setAvatarUrl(prevHeaderUrl)
            toast.error(t.profile.errors.uploadFailed)
        } finally {
            URL.revokeObjectURL(previewUrl)
            setUploading(false)
            e.target.value = ''
        }
    }

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleChange}
                aria-label={t.profile.banner.uploadAvatar}
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 z-20 bg-[#44ddc1] rounded-[12px] p-2 flex items-center justify-center shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] disabled:opacity-50 transition-opacity hover:opacity-90"
                aria-label={t.profile.banner.uploadAvatar}
            >
                {uploading ? (
                    <div className="size-[11px] animate-spin rounded-full border-2 border-[#0b1120]/30 border-t-[#0b1120]" />
                ) : (
                    <Camera className="size-[11px] text-[#0b1120]" />
                )}
            </button>
        </>
    )
}
