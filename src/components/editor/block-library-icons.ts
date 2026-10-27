import {
    Package, FileText, Image as ImageIcon, Briefcase, ShoppingCart, ClipboardList, Puzzle, LayoutTemplate,
    PanelTop, MousePointerClick, MessageCircle, Banknote, Table, Images, MapPin, Star, Timer,
    ArrowLeftRight, ListChecks, Download, Clapperboard, Link as LinkIcon, Minus, Megaphone, Building2,
    FolderOpen, ListOrdered, Wrench, Utensils, GalleryHorizontal, Share2, Code,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Category icons — matches editor-v2 design prototype (BLOCK_GROUPS).
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
    basics: Package,
    content: FileText,
    media: ImageIcon,
    store: Briefcase,
    commerce: ShoppingCart,
    form: ClipboardList,
    widgets: Puzzle,
    layout: LayoutTemplate,
}

// Block slug → icon. Prototype-defined icons first; the rest are sensible lucide equivalents.
export const BLOCK_ICONS: Record<string, LucideIcon> = {
    'custom-html': Code,
    hero: PanelTop,
    gallery: Images,
    cta: MousePointerClick,
    socialWidget: Share2,
    pricing: Banknote,
    'pricing-table': Table,
    'gallery-masonry': Images,
    'whatsapp-button': MessageCircle,
    'google-maps': MapPin,
    'social-proof': Star,
    'countdown-timer': Timer,
    'before-after': ArrowLeftRight,
    'feature-comparison': ListChecks,
    'download-cta': Download,
    'video-background': Clapperboard,
    breadcrumb: LinkIcon,
    divider: Minus,
    'announcement-bar': Megaphone,
    'client-logos': Building2,
    accordion: FolderOpen,
    'step-process': ListOrdered,
    'portfolio-grid': Briefcase,
    'menu-food': Utensils,
    'service-cards': Wrench,
    carousel: GalleryHorizontal,
}

export const FALLBACK_CATEGORY_ICON: LucideIcon = Package
export const FALLBACK_BLOCK_ICON: LucideIcon = Puzzle
