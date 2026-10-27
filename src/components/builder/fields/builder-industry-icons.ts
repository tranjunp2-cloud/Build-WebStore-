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
    type LucideIcon,
} from 'lucide-react'

/** Industry value (TEMPLATE_CATEGORY_OPTIONS) → lucide icon shown in the picker badge. */
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

export const DEFAULT_INDUSTRY = 'restaurant'

export function getIndustryIcon(value: string | undefined): LucideIcon {
    return (value && INDUSTRY_ICONS[value]) || Briefcase
}
