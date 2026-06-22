'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, ClipboardList, HelpCircle, BookOpen, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/i18n'

export function HelpCenterNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  const TABS: { name: string; href: string; Icon: LucideIcon }[] = [
    { name: t.help.nav.overview, href: '/help', Icon: ClipboardList },
    { name: t.help.nav.qna, href: '/help/qna', Icon: HelpCircle },
    { name: t.help.nav.modules, href: '/help/modules', Icon: BookOpen }
  ]

  const activeTab =
    TABS.find((t) =>
      t.href === '/help' ? pathname === t.href : pathname.startsWith(t.href)
    ) ?? TABS[0]

  return (
    <div className="w-full mb-6">
      {/* ───────── Desktop Tabs ───────── */}
      <div className="hidden md:flex p-1 bg-[hsl(var(--secondary))] rounded-lg w-max border border-[hsl(var(--border))] shadow-sm">
        {TABS.map((tab) => {
          const isActive =
            tab.href === '/help'
              ? pathname === tab.href
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-white'
              }`}
            >
              <tab.Icon className="w-4 h-4 shrink-0" aria-hidden />
              {tab.name}
            </Link>
          )
        })}
      </div>

      {/* ───────── Mobile Dropdown ───────── */}
      <div className={`md:hidden relative rounded-lg ${open ? 'border border-[hsl(var(--border))]' : ''}`}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between px-4 py-2.5 bg-[hsl(var(--card))] rounded-lg text-sm font-semibold text-white focus:outline-none ${open ? 'rounded-b-none' : 'border border-[hsl(var(--border))]'}`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            <activeTab.Icon className="w-4 h-4 shrink-0" aria-hidden />
            {activeTab.name}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="bg-[hsl(var(--card))] border-t border-t-border rounded-b-lg overflow-hidden">
            {TABS.map((tab) => {
              const isActive =
                tab.href === '/help'
                  ? pathname === tab.href
                  : pathname.startsWith(tab.href)
              return (
                <button
                  key={tab.href}
                  onClick={() => {
                    router.push(tab.href)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 text-left px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-[hsl(var(--secondary))]'
                  }`}
                >
                  <tab.Icon className="w-4 h-4 shrink-0" aria-hidden />
                  {tab.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
