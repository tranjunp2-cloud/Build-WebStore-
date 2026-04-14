'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, BookOpen } from 'lucide-react'
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
  icon: string
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
  const d: HelpModulesData = {
    dashboard: raw?.dashboard ?? { label: '', steps: [] },
    builder: raw?.builder ?? { label: '', steps: [] },
    blog: raw?.blog ?? { label: '', steps: [] },
    settings: raw?.settings ?? { label: '', steps: [] },
  }

  const MODULES_DATA: ModuleData[] = [
    {
      id: 'dashboard',
      icon: '📊',
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
      icon: '🚀',
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
      icon: '📝',
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
      icon: '⚙️',
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
      {/* Module Tabs Header */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MODULES_DATA.map((module) => (
          <button
            key={module.id}
            onClick={() => handleTabClick(module.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-[20px] border transition-all duration-200 ${
              activeModule === module.id
                ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                : 'bg-[#161E2E] border-[#1F2937] text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6]'
            }`}
          >
            {module.icon} {module.label}
          </button>
        ))}
      </div>

      {/* Module Contents Array */}
      {MODULES_DATA.map((module) => (
        <div
          key={module.id}
          id={module.id}
          ref={(el) => {
            sectionRefs.current[module.id] = el
          }}
          className={`flex-col transition-opacity duration-300 border border-[#1F2937] rounded-xl p-4 bg-[#0F172A]/30 ${
            activeModule === module.id ? 'flex opacity-100' : 'hidden opacity-0'
          }`}
        >
          {module.steps.map((step) => (
            <div
              key={`${module.id}-step-${step.num}`}
              className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 mb-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[16px] font-bold text-white flex items-center mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] text-white text-[13px] font-bold mr-2.5 shrink-0">
                  {step.num}
                </span>
                {step.title}
              </h3>

              <div className="text-[#9CA3AF] text-[14px] leading-[22px] mb-4">
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
                    className="rounded-lg overflow-hidden border border-[#1F2937] cursor-pointer hover:border-[#3B82F6]/50 hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition-all bg-[#0F172A] inline-flex flex-col"
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
                    <div className="px-3 py-1.5 border-t border-[#1F2937] flex items-center justify-between gap-4 w-full">
                      <span className="text-[11px] text-[#9CA3AF] truncate">{step.imgTitle}</span>
                      <span className="text-[11px] text-[#3B82F6] whitespace-nowrap">{t.help.modules.lazyScreenshot.clickToZoom}</span>
                    </div>
                  </div>
                  </div>
                )
              })()}

              {/* Step-by-step text guide */}
              {step.guide.length > 0 && (
                <div className="rounded-lg border border-[#1F2937] bg-[#0F172A] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-[#3B82F6]" />
                    <span className="text-[13px] font-semibold text-[#3B82F6]">{t.help.modules.tab.stepByStepGuide}</span>
                  </div>
                  <ol className="space-y-2.5">
                    {step.guide.map((line, idx) => (
                      <li key={idx} className="flex gap-3 text-[13px] leading-[20px]">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1E293B] text-[#3B82F6] text-[11px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-[#CBD5E1]" dangerouslySetInnerHTML={{ __html: line }} />
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
            className="relative w-[90vw] max-w-6xl h-[85vh] rounded-xl overflow-hidden cursor-default touch-pan-x touch-pan-y touch-pinch-zoom bg-[#1e293b] flex items-center justify-center"
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
