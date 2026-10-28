import type { DiscountDoc } from '../_components/discount-form'

/** The Payload discount (server page `findByID` or `GET /api/v1/discounts/[id]`) as the edit form takes it. */
export function toDiscountDoc(d: any): DiscountDoc {
    return {
        id: String(d.id),
        code: d.code,
        description: d.description ?? null,
        type: d.type,
        value: d.value,
        status: d.status,
        usageCount: d.usageCount ?? 0,
        usageLimit: d.usageLimit ?? null,
        startsAt: d.startsAt ?? null,
        expiresAt: d.expiresAt ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    }
}
