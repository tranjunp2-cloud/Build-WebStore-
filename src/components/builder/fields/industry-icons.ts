import type { LucideIcon } from 'lucide-react'
import {
    Briefcase,
    Building2,
    Croissant,
    Dumbbell,
    Flower2,
    GraduationCap,
    House,
    Laptop,
    Newspaper,
    Palette,
    PartyPopper,
    Plane,
    ShoppingBag,
    Stethoscope,
    UtensilsCrossed,
} from 'lucide-react'

// Industry value (TEMPLATE_CATEGORY_OPTIONS) → lucide icon, replacing the emoji
// that /api/data/industries returns. Matches the AI Builder design prototype.
const INDUSTRY_ICONS: Record<string, LucideIcon> = {
    restaurant: UtensilsCrossed,
    ecommerce: ShoppingBag,
    beauty: Flower2,
    tech: Laptop,
    health: Stethoscope,
    education: GraduationCap,
    realestate: House,
    fitness: Dumbbell,
    creative: Palette,
    business: Building2,
    fnb: Croissant,
    events: PartyPopper,
    blog: Newspaper,
    travel: Plane,
}

export function getIndustryIcon(value: string): LucideIcon {
    return INDUSTRY_ICONS[value] ?? Briefcase
}
