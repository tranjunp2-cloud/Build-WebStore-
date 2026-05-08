import { NextResponse } from 'next/server'
import { isOwner } from './role-utils'

export { isOwner } from './role-utils'

type UserLike = {
    roles?: string[]
    tenants?: Array<{ role?: string }>
}

export function blockOwner(user: UserLike): NextResponse | null {
    if (isOwner(user)) {
        return NextResponse.json(
            { error: 'Owner accounts must update profile via SSO portal' },
            { status: 403 },
        )
    }
    return null
}
