'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n'

export function HelpCenterNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  const TABS = [
    { name: t.help.nav.overview, href: '/help' },
    { name: t.help.nav.qna, href: '/help/qna' },
    { name: t.help.nav.modules, href: '/help/modules' }
  ]

  const activeTab =
    TABS.find((t) =>
      t.href === '/help' ? pathname === t.href : pathname.startsWith(t.href)
    ) ?? TABS[0]

  return (
    <div className="w-full mb-6">
      {/* ───────── Desktop Tabs ───────── */}
      <div className="hidden md:flex p-1 bg-[#1F2937] rounded-lg w-max border border-[#1F2937] shadow-sm">
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
                  ? 'bg-[#0B1120] text-blue-500 shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              {tab.name}
            </Link>
          )
        })}
      </div>

      {/* ───────── Mobile Dropdown ───────── */}
      {/* Figma: width 343px, height 43px, bg #161E2E, border 1px #1F2937, radius 8px */}
      <div className="md:hidden relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-[#161E2E] border border-[#1F2937] rounded-lg text-sm font-semibold text-white"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{activeTab.name}</span>
          <ChevronDown
            className={`w-4 h-4 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#161E2E] border border-[#1F2937] rounded-lg shadow-lg z-50 overflow-hidden">
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
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-[#9CA3AF] hover:text-white hover:bg-[#1F2937]'
                  }`}
                >
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
