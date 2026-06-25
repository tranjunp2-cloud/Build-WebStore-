'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, BookOpen, BarChart3, Rocket, PenLine, Settings, ZoomIn, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

interface StepData {
  num: number
  title: string
  desc: string
  imgSrc?: string
  imgTitle?: string
  imgWidth?: number
  imgHeight?: number
  guide: string[]
}

interface ModuleData {
  id: string
  Icon: LucideIcon
  label: string
  steps: StepData[]
}

interface LocaleStep {
  title: string
  desc: string
  imgTitle?: string
  guide?: string[]
}

interface LocaleModule {
  label: string
  steps: LocaleStep[]
}

interface HelpModulesData {
  dashboard: LocaleModule
  builder: LocaleModule
  blog: LocaleModule
  settings: LocaleModule
}

export function ModuleGuidesTab() {
  const { t } = useI18n()

  const raw = t.help.modules.data as unknown as Partial<HelpModulesData> | undefined
  const safeModule = (m?: Partial<LocaleModule>): LocaleModule => ({
    label: m?.label ?? '',
    steps: m?.steps ?? [],
  })
  const d: HelpModulesData = {
    dashboard: safeModule(raw?.dashboard),
    builder: safeModule(raw?.builder),
    blog: safeModule(raw?.blog),
    settings: safeModule(raw?.settings),
  }

  const MODULES_DATA: ModuleData[] = [
    {
      id: 'dashboard',
      Icon: BarChart3,
      label: d.dashboard.label,
      steps: [
        {
          num: 1,
          title: d.dashboard.steps[0].title,
          desc: d.dashboard.steps[0].desc,
          imgSrc: '/help/dashboard-1-overview.jpg',
          imgWidth: 3322,
          imgHeight: 2072,
          imgTitle: d.dashboard.steps[0].imgTitle,
          guide: d.dashboard.steps[0].guide || [],
        }
      ]
    },
    {
      id: 'builder',
      Icon: Rocket,
      label: d.builder.label,
      steps: (d.builder.steps || []).map((s: LocaleStep, i: number) => ({
        num: i + 1,
        title: s.title,
        desc: s.desc,
        imgSrc: ['/help/builder-1-info.jpg', '/help/builder-2-processing.jpg', '/help/builder-3-preview-desktop.jpg', '/help/builder-4-ai-chat.jpg', '/help/builder-5-templates.jpg', '/help/builder-6-components.jpg'][i],
        imgWidth: [916, 510, 942, 371, 1210, 353][i],
        imgHeight: [827, 509, 741, 838, 837, 816][i],
        imgTitle: s.imgTitle,
        guide: s.guide || [],
      })),
    },
    {
      id: 'blog',
      Icon: PenLine,
      label: d.blog.label,
      steps: (d.blog.steps || []).map((s: LocaleStep, i: number) => ({
        num: i + 1,
        title: s.title,
        desc: s.desc,
        imgSrc: [undefined, '/help/blog-1-create.jpg', undefined, undefined][i],
        imgWidth: [undefined, 1626, undefined, undefined][i],
        imgHeight: [undefined, 728, undefined, undefined][i],
        imgTitle: s.imgTitle,
        guide: s.guide || [],
      })),
    },
    {
      id: 'settings',
      Icon: Settings,
      label: d.settings.label,
      steps: [
        {
          num: 1,
          title: d.settings.steps[0].title,
          desc: d.settings.steps[0].desc,
          imgSrc: '/help/settings-1-domains.jpg',
          imgWidth: 1631,
          imgHeight: 790,
          imgTitle: d.settings.steps[0].imgTitle,
          guide: d.settings.steps[0].guide || [],
        }
      ]
    }
  ]

  const [activeModule, setActiveModule] = useState<string>('dashboard')
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null)

  // Ref container hooks for Anchor scrolling
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Xử lý deep Url Hash Anchor jump TC-F20.08 và TC-F20.13
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && MODULES_DATA.some(m => m.id === hash)) {
        setActiveModule(hash)
        setTimeout(() => {
          const el = sectionRefs.current[hash]
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 150)
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleTabClick = (id: string) => {
    setActiveModule(id)
    window.history.pushState(null, '', `#${id}`)
  }

  // Handle ESC closing Lightbox TC-F20.10
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImg(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Lock Body Scrolling when lightbox open TC-F20.17
  useEffect(() => {
    if (lightboxImg) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [lightboxImg])

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Module Tabs Header — underline tabs (matches DashboardTabs / Discounts / Team & Account
          via the global `.dash-tab-trigger` underline on data-state=active). Wraps on narrow
          screens (no horizontal scrollbar). */}
      <div
        className="flex flex-wrap gap-0 mb-6"
        style={{ borderBottom: '1px solid var(--dash-divider)' }}
      >
        {MODULES_DATA.map((module) => {
          const isActive = activeModule === module.id
          return (
            <button
              key={module.id}
              type="button"
              data-state={isActive ? 'active' : 'inactive'}
              onClick={() => handleTabClick(module.id)}
              className={cn(
                'dash-tab-trigger flex items-center gap-1.5 px-4 pb-2.5 rounded-none text-[13px] font-semibold transition-colors -mb-px cursor-pointer whitespace-nowrap',
                isActive
                  ? 'text-[var(--dash-text)]'
                  : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'
              )}
            >
              <module.Icon className="w-4 h-4 shrink-0" aria-hidden /> {module.label}
            </button>
          )
        })}
      </div>

      {/* Module Contents Array */}
      {MODULES_DATA.map((module) => (
        <div
          key={module.id}
          id={module.id}
          ref={(el) => {
            sectionRefs.current[module.id] = el
          }}
          className={`flex-col transition-opacity duration-300 border border-[hsl(var(--border))] rounded-xl p-4 bg-[hsl(var(--background)/0.3)] ${
            activeModule === module.id ? 'flex opacity-100' : 'hidden opacity-0'
          }`}
        >
          {module.steps.map((step) => (
            <div
              key={`${module.id}-step-${step.num}`}
              className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 mb-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[16px] font-bold text-white flex items-center mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--primary))] !text-white text-[13px] font-bold mr-2.5 shrink-0">
                  {step.num}
                </span>
                {step.title}
              </h3>

              <div className="text-[hsl(var(--muted-foreground))] text-[14px] leading-[22px] mb-4">
                <p dangerouslySetInnerHTML={{ __html: step.desc }} />
              </div>

              {/* Screenshot thumbnail (click to zoom) */}
              {step.imgSrc && (() => {
                const w = step.imgWidth || 800
                const h = step.imgHeight || 450
                const isPortrait = h > w
                // Cap: landscape max 480px wide, portrait max 240px wide
                const maxW = isPortrait ? 'max-w-[240px]' : 'max-w-[480px]'
                return (
                  <div className="flex justify-center md:justify-start mb-4">
                  <div
                    className="rounded-lg overflow-hidden border border-[hsl(var(--border))] cursor-pointer hover:border-[hsl(var(--primary)/0.5)] hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] transition-all bg-[hsl(var(--background))] inline-flex flex-col"
                    onClick={() => setLightboxImg({ src: step.imgSrc!, title: step.imgTitle || step.title })}
                  >
                    <div className={maxW}>
                      <Image
                        src={step.imgSrc!}
                        alt={step.imgTitle || step.title}
                        width={w}
                        height={h}
                        className="w-full h-auto block"
                        quality={95}
                        unoptimized
                      />
                    </div>
                    <div className="px-3 py-1.5 border-t border-[hsl(var(--border))] flex items-center justify-between gap-4 w-full">
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{step.imgTitle}</span>
                      <span className="text-[11px] text-[hsl(var(--primary))] whitespace-nowrap flex items-center gap-1"><ZoomIn className="w-3 h-3 shrink-0" aria-hidden />{t.help.modules.lazyScreenshot.clickToZoom}</span>
                    </div>
                  </div>
                  </div>
                )
              })()}

              {/* Step-by-step text guide */}
              {step.guide.length > 0 && (
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-[hsl(var(--primary))]" />
                    <span className="text-[13px] font-semibold text-[hsl(var(--primary))]">{t.help.modules.tab.stepByStepGuide}</span>
                  </div>
                  <ol className="space-y-2.5">
                    {step.guide.map((line, idx) => (
                      <li key={idx} className="flex gap-3 text-[13px] leading-[20px]">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] text-[11px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-[hsl(var(--foreground))]" dangerouslySetInnerHTML={{ __html: line }} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Lightbox / Modal View TC-F20.09 & TC-F20.16 */}
      {lightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImg.title}
          className="fixed inset-0 z-[1000] bg-black/85 flex items-center justify-center animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setLightboxImg(null)
            }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-colors z-[1001]"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative w-[90vw] max-w-6xl h-[85vh] rounded-xl overflow-hidden cursor-default touch-pan-x touch-pan-y touch-pinch-zoom bg-[hsl(var(--secondary))] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightboxImg.src}
              alt={lightboxImg.title}
              fill
              className="object-contain"
              quality={100}
              sizes="90vw"
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-[12px]">
            {t.help.modules.tab.escToClose}
          </div>
        </div>
      )}
    </div>
  )
}
