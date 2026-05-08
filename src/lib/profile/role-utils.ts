type UserLike = {
    roles?: string[]
    tenants?: Array<{ role?: string }>
}

export function isOwner(user: UserLike): boolean {
    if (user.roles?.includes('tenant-owner')) return true
    return user.tenants?.some((t) => t.role === 'owner') ?? false
}
