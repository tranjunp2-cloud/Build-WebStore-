import {
    Banknote, BookOpen, Briefcase, Building2, ChartColumn, CircleHelp, Clapperboard, ClipboardList,
    Eye, FileText, GalleryHorizontal, Image, Images, Inbox, LayoutTemplate, Mail, Megaphone, MessageCircle,
    MessageSquareQuote, Minus, MousePointerClick, Newspaper, Package, Palette, PanelTop, Puzzle, Scale,
    Share2, ShoppingBag, ShoppingCart, Sparkles, Star, Type, Users, UtensilsCrossed, Wrench, Blocks,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Block library icons (lucide) — replace the registry emoji in the editor's Components tab.

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
    basics: Package,
    content: FileText,
    media: Image,
    store: Briefcase,
    commerce: ShoppingCart,
    form: ClipboardList,
    widgets: Puzzle,
    layout: LayoutTemplate,
}

export const BLOCK_ICONS: Record<string, LucideIcon> = {
    hero: PanelTop,
    features: Sparkles,
    about: BookOpen,
    cta: MousePointerClick,
    'service-cards': Wrench,
    testimonials: MessageSquareQuote,
    faq: CircleHelp,
    'blog-list': Newspaper,
    'custom-html': Type,
    'portfolio-grid': Palette,
    gallery: Images,
    video: Clapperboard,
    carousel: GalleryHorizontal,
    pricing: Banknote,
    'feature-comparison': Scale,
    'menu-food': UtensilsCrossed,
    'products-grid': ShoppingBag,
    'products-featured': Star,
    cartWidget: ShoppingCart,
    'product-quick-view': Eye,
    contact: Inbox,
    newsletter: Mail,
    'whatsapp-button': MessageCircle,
    stats: ChartColumn,
    team: Users,
    'logo-cloud': Building2,
    socialWidget: Share2,
    divider: Minus,
    'announcement-bar': Megaphone,
}

export const FALLBACK_BLOCK_ICON: LucideIcon = Blocks
