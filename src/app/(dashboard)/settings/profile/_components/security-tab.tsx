'use client'

import { SsoGuardBox } from './sso-guard-box'
import { PasswordChangeForm } from './password-change-form'

type Props = {
    role: 'owner' | 'staff'
    ssoUrl: string
}

export function SecurityTab({ role, ssoUrl }: Props) {
    if (role === 'owner') {
        return <SsoGuardBox ssoUrl={ssoUrl} variant="security" />
    }

    return <PasswordChangeForm />
}
