'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useI18n } from '@/i18n'

const TAB_IDS = ['admissions', 'training', 'retail', 'fnb', 'events', 'other'] as const
const TAB_ICONS: Record<string, string> = {
  admissions: '🎓',
  training: '📚',
  retail: '🛒',
  fnb: '🍽️',
  events: '🎫',
  other: '✨',
}

type TabId = (typeof TAB_IDS)[number]

export function SolutionTabs() {
  const { t } = useI18n()
  const [active, setActive] = useState<TabId>('admissions')
  const [direction, setDirection] = useState<'right' | 'left'>('right')
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const industries = t.landing.solutions.industries

  const TABS = TAB_IDS.map((id) => ({
    id,
    label: industries[id].label,
  }))

  const activeIndex = TABS.findIndex((tab) => tab.id === active)
  const content = industries[active]

  // Sliding pill indicator — update on tab change or resize
  const updatePill = useCallback(() => {
    const el = tabRefs.current[activeIndex]
    if (!el) return
    setPillStyle({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeIndex])
  useEffect(() => {
    updatePill()
    const timer = setTimeout(updatePill, 100)
    return () => clearTimeout(timer)
  }, [updatePill])
  useEffect(() => {
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [updatePill])

  const handleTabClick = (id: TabId, index: number) => {
    if (id === active) return
    setDirection(index > activeIndex ? 'right' : 'left')
    setActive(id)
  }

  return (
    <div className="space-y-8">
      {/* Tab bar với pill trượt */}
      <div className="relative flex flex-wrap justify-center gap-1 p-1.5 rounded-2xl bg-zinc-100 border border-zinc-200">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el }}
            type="button"
            onClick={() => handleTabClick(tab.id, index)}
            className={`relative z-10 rounded-xl px-5 py-3 text-sm font-semibold transition-colors duration-200 ${
              active === tab.id
                ? 'text-white'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span
          className="absolute bottom-1.5 top-1.5 z-0 rounded-xl bg-sky-500 shadow-lg shadow-sky-500/30 transition-all duration-300 ease-out"
          style={{ left: pillStyle.left + 6, width: pillStyle.width - 12 }}
        />
      </div>

      {/* Card lớn: trái minh họa theo lĩnh vực, phải nội dung slide */}
      <div className="rounded-3xl border-2 border-zinc-200 bg-white shadow-2xl shadow-zinc-200/50 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[360px]">
          {/* Left: thay đổi theo tab */}
          <div className="relative min-h-[260px] lg:min-h-[360px] bg-gradient-to-br from-sky-50 via-blue-50 to-sky-100 flex items-center justify-center p-8 transition-colors duration-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-white/90 border-2 border-sky-200 shadow-xl flex items-center justify-center text-6xl transition-transform duration-300 hover:scale-105">
                {TAB_ICONS[active]}
              </div>
            </div>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-40 rounded-xl bg-white/95 border-2 border-dashed border-sky-200 shadow-lg p-3 text-xs text-zinc-600 space-y-1.5 hidden sm:block animate-float">
              <p className="font-bold text-zinc-800">{content.block1.title}</p>
              {content.block1.items.map((item, i) => (
                <p key={i}>{item}</p>
              ))}
            </div>
            <div className="absolute right-4 bottom-10 w-44 rounded-xl bg-white/95 border-2 border-dashed border-sky-200 shadow-lg p-3 text-xs text-zinc-600 space-y-1.5 hidden sm:block animate-float-delay">
              <p className="font-bold text-zinc-800">{content.block2.title}</p>
              {content.block2.items.map((item, i) => (
                <p key={i}>{item}</p>
              ))}
            </div>
          </div>

          {/* Right: nội dung slide theo tab */}
          <div className="relative overflow-hidden p-8 lg:p-10 flex flex-col justify-center bg-gradient-to-b from-white to-zinc-50/50">
            <div
              key={active}
              className={`${direction === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
            >
              <h3 className="text-2xl font-heading font-bold text-zinc-900 mb-6">
                {content.title}
              </h3>
              <ul className="space-y-3 mb-8">
                {content.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-zinc-600 text-sm">
                    <span className="text-sky-500 mt-0.5 shrink-0">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="rotate-45">
                        <path d="M8 0L16 8L8 16L0 8L8 0Z" />
                      </svg>
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-zinc-500 mb-3">{t.landing.solutionsMeta.trustedBy}</p>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                  Logo 1
                </div>
                <div className="w-14 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                  Logo 2
                </div>
                <div className="w-14 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                  Logo 3
                </div>
              </div>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold px-8 py-3.5 text-sm w-fit transition-all hover:shadow-lg hover:shadow-sky-500/25"
              >
                {t.landing.solutionsMeta.learnMore}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
