import {
  ArrowRight, Banknote, Bell, Bold, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  ClipboardList, Clock, Copy, CreditCard, FileText, Flower2, Gauge, Globe, GripVertical, Italic, Landmark, Languages,
  LayoutTemplate, Link as LinkIcon, Lock, Menu, MousePointerClick, Moon, Package, PenLine, Plus, Printer, QrCode,
  RotateCcw, Search, Send, ShoppingBag, ShoppingCart, Sparkles, Stethoscope, Store, Sun, Tag, Trash2, Truck, Underline,
  Undo2, Utensils, UtensilsCrossed, Wand2, X,
} from 'lucide-react'

const ICONS = {
  'arrow-right': ArrowRight, banknote: Banknote, bell: Bell, bold: Bold, bot: Bot, check: Check,
  'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  'circle-alert': CircleAlert, 'circle-check': CircleCheck, 'clipboard-list': ClipboardList, clock: Clock, copy: Copy,
  'credit-card': CreditCard, 'file-text': FileText, 'flower-2': Flower2, gauge: Gauge, globe: Globe,
  'grip-vertical': GripVertical, italic: Italic, landmark: Landmark, languages: Languages,
  'layout-template': LayoutTemplate, link: LinkIcon, lock: Lock, menu: Menu,
  'mouse-pointer-click': MousePointerClick, moon: Moon, package: Package, 'pen-line': PenLine, plus: Plus,
  printer: Printer, 'qr-code': QrCode, 'rotate-ccw': RotateCcw, search: Search, send: Send,
  'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart, sparkles: Sparkles, stethoscope: Stethoscope,
  store: Store, sun: Sun, tag: Tag, 'trash-2': Trash2, truck: Truck, underline: Underline, 'undo-2': Undo2,
  utensils: Utensils, 'utensils-crossed': UtensilsCrossed, 'wand-2': Wand2, x: X,
} as const

export type IconName = keyof typeof ICONS

/** Decorative lucide icon in a fixed-size box (same markup as the prototype's `.ic` span). */
export function Ic({ n, s = 16, className }: { n: IconName; s?: number; className?: string }) {
  const Icon = ICONS[n]
  return (
    <span className={className ? `ic ${className}` : 'ic'} aria-hidden="true" style={{ width: s, height: s }}>
      <Icon width={s} height={s} strokeWidth={2} />
    </span>
  )
}
