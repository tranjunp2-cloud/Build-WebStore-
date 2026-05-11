type UserLike = {
    tenants?: Array<{ role?: string }>
}

export function isOwner(user: UserLike): boolean {
    return user.tenants?.some((t) => t.role === 'owner') ?? false
}
