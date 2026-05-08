'use client'

import { createContext, useContext, useState } from 'react'

type UserAvatarCtx = {
    avatarUrl: string | null
    setAvatarUrl: (url: string | null) => void
}

const UserAvatarContext = createContext<UserAvatarCtx>({
    avatarUrl: null,
    setAvatarUrl: () => {},
})

export function UserAvatarProvider({
    children,
    initialUrl,
}: {
    children: React.ReactNode
    initialUrl: string | null
}) {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl)
    return (
        <UserAvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>
            {children}
        </UserAvatarContext.Provider>
    )
}

export const useUserAvatar = () => useContext(UserAvatarContext)
