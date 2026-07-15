'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { useI18n } from '@/i18n'

export function AIDiscoveryWizard({ userId }: { userId?: number | string }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  // True once Skip/Explore persisted the dismissal — blocks the reopen-on-navigation effect below
  const dismissedPermanently = useRef(false)

  const WIZARD_STEPS = [
    {
      title: t.onboarding.wizard.slides.editor.title,
      description: t.onboarding.wizard.slides.editor.description,
      icon: "/images/f06/wizard/ai-editor-demo.gif",
      gradient: "from-blue-500/20 to-teal-400/20"
    },
    {
      title: t.onboarding.wizard.slides.content.title,
      description: t.onboarding.wizard.slides.content.description,
      icon: "/images/f06/wizard/ai-content-writing-demo.gif",
      gradient: "from-teal-400/20 to-blue-500/20"
    },
    {
      title: t.onboarding.wizard.slides.seo.title,
      description: t.onboarding.wizard.slides.seo.description,
      icon: "/images/f06/wizard/ai-seo-optimization-demo.gif",
      gradient: "from-blue-500/20 via-teal-400/20 to-blue-500/20"
    }
  ]

  // Media loading states
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; title: string } | null>(null)

  // Swipe handling logic
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Preload all GIFs on mount
  useEffect(() => {
    WIZARD_STEPS.forEach(step => {
      const img = new window.Image()
      img.src = step.icon
    })
  }, [])

  // Reset image states when step changes
  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
  }, [currentStep])

  // ESC key closes lightbox
  useEffect(() => {
    if (!lightboxSrc) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [lightboxSrc])

  // X only hides the wizard for the current session. The (dashboard) layout never
  // remounts on soft navigation, so reopen here when the user returns to the
  // dashboard home — unless Skip/Explore dismissed it permanently. (GH #1609)
  useEffect(() => {
    if (pathname === '/dashboard' && !dismissedPermanently.current) {
      setIsOpen(true)
    }
  }, [pathname])

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const stepData = WIZARD_STEPS[currentStep]
  const isLastStep = currentStep === WIZARD_STEPS.length - 1

  // Dismiss wizard permanently (Skip / Explore only) — close UI + persist has_seen_ai_wizard=true to DB
  const dismissWizard = () => {
    dismissedPermanently.current = true
    setIsOpen(false)

    if (userId) {
      fetch('/api/user/dismiss-wizard', {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        console.error('Failed to persist wizard dismiss state', error)
      })
    }

    window.dispatchEvent(new CustomEvent('wizard-closed', { detail: { permanent: true } }))
  }

  // Close for the current session only (X button) — no API call, so the wizard
  // returns on the next visit to the dashboard home. Still announces 'wizard-closed'
  // so PushOptInPrompt can take its turn — detail.permanent lets listeners tell this
  // apart from a real dismissal (GH #1609).
  const closeForNow = () => {
    setIsOpen(false)
    setCurrentStep(0)
    window.dispatchEvent(new CustomEvent('wizard-closed', { detail: { permanent: false } }))
  }

  const handleNext = () => {
    if (isTransitioning) return
    if (!isLastStep) {
      setIsTransitioning(true)
      setCurrentStep(prev => prev + 1)
      setTimeout(() => setIsTransitioning(false), 300)
    } else {
      dismissWizard()
    }
  }

  const handlePrev = () => {
    if (isTransitioning || currentStep === 0) return
    setIsTransitioning(true)
    setCurrentStep(prev => prev - 1)
    setTimeout(() => setIsTransitioning(false), 300)
  }

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && !isLastStep) {
      handleNext()
    } else if (isRightSwipe) {
      handlePrev()
    }
  }

  return (
    <div className="dash-shell">
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/60 backdrop-blur-[2px] p-6 sm:p-4">
      {/* Modal Container */}
      <div
        className="relative w-full max-w-[340px] sm:max-w-[672px] h-auto max-h-[90vh] bg-[#0F172A]/95 border border-solid border-white/10 rounded-[24px] shadow-[0_0_40px_rgba(59,130,246,0.15)] flex flex-col sm:overflow-hidden touch-pan-y backdrop-blur-xl shrink-0"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-7 pb-5 sm:px-8 sm:py-6 gap-4">
          <h2 className="flex items-center gap-2 text-[18px] sm:text-[24px] font-bold text-[#F8FAFC] tracking-tight leading-[1.4] max-w-[180px] sm:max-w-none">
            <Sparkles className="h-5 w-5 shrink-0 text-blue-400" aria-hidden />
            {t.onboarding.wizard.title}
          </h2>
          <button
            onClick={closeForNow}
            className="flex-shrink-0 text-white/40 hover:text-white transition-colors bg-transparent border-none p-1 m-0 cursor-pointer flex items-center justify-center mt-1"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Header Divider Line */}
        <hr className="w-full border-t border-white/5 m-0" />

        {/* Content Area */}
        <div className="flex-1 min-h-0 flex flex-col items-center pt-6 px-6 sm:pt-10 sm:px-8 pb-4 sm:pb-8 gap-6 sm:gap-8 overflow-y-auto custom-scrollbar">
          <div key={currentStep} className="animate-wizard-fade-in flex flex-col items-center gap-6 sm:gap-8 w-full">

            {/* Top: Media Showcase */}
            <div
              className={`relative w-full max-w-[290px] aspect-video sm:aspect-video sm:w-full sm:max-w-none sm:h-auto rounded-[16px] bg-gradient-to-br ${stepData.gradient} flex items-center justify-center mx-auto sm:mx-0 border border-white/5 shrink-0 overflow-hidden ${imageLoaded && !imageError ? 'cursor-pointer hover:border-[#3B82F6]/50 hover:shadow-[0_0_12px_rgba(59,130,246,0.15)]' : ''} transition-all`}
              onClick={() => imageLoaded && !imageError && setLightboxSrc({ src: stepData.icon, title: stepData.title })}
            >
              {/* Shimmer skeleton — visible while image loads */}
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 bg-white/5 animate-pulse rounded-[16px]" />
              )}
              {/* Error fallback */}
              {imageError ? (
                <div className="flex flex-col items-center justify-center gap-3 text-white/30">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12L18 9L15 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="8" cy="9" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3 17L8 12L11 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm font-medium">{stepData.title}</span>
                </div>
              ) : (
                <Image
                  src={stepData.icon}
                  alt={stepData.title}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 290px, 672px"
                  className={`object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              )}
            </div>

            {/* Zoom hint */}
            {imageLoaded && !imageError && (
              <span className="text-[11px] text-[#3B82F6]/60 -mt-4 sm:-mt-6">Click to zoom</span>
            )}

            {/* Bottom: Text & Pagination */}
            <div className="flex flex-col items-center text-center shrink-0">
              <h3 className="text-[18px] sm:text-[24px] font-bold text-[#F8FAFC] tracking-tight leading-snug m-0 mb-3 sm:mb-4">
                {stepData.title}
              </h3>
              <p className="text-[13px] sm:text-[16px] leading-[1.6] sm:leading-[1.625] text-[#64748B] max-w-[260px] sm:max-w-[576px] m-0 mb-6 sm:mb-8 min-h-[40px] sm:min-h-[52px]">
                {stepData.description}
              </p>
            </div>
          </div>

          {/* Dots — outside fade animation to avoid flickering */}
          <div className="flex items-center justify-center gap-[6px] sm:gap-[8px] mb-6 sm:mb-10">
            {WIZARD_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`rounded-full transition-all duration-300 ${idx === currentStep
                    ? "w-[24px] sm:w-[32px] h-[4px] sm:h-[8px] bg-[#3B82F6]"
                    : "w-[4px] sm:w-[8px] h-[4px] sm:h-[8px] bg-white/10"
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Footer Divider Line */}
        <hr className="w-full border-t border-white/5 m-0" />

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between px-6 py-3 sm:py-6 mt-auto sm:mt-0 gap-2 sm:gap-0 shrink-0">

          <button
            onClick={dismissWizard}
            className="text-[12px] sm:text-[14px] font-medium text-[#F8FAFC]/40 hover:text-[#F8FAFC] transition-colors bg-transparent border-none p-0 m-0 cursor-pointer flex items-center justify-center order-1 sm:order-none"
          >
            {t.onboarding.wizard.footer.skipInstructions || t.onboarding.wizard.footer.skip}
          </button>

          {/* Primary & Back Actions */}
          <div className="flex items-center justify-center gap-3 sm:gap-3 sm:ml-auto order-2 sm:order-none">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                disabled={isTransitioning}
                className="px-4 min-w-[80px] sm:min-w-[104px] h-[30px] sm:h-[36px] text-[12px] sm:text-[14px] leading-none font-medium text-[#F8FAFC] rounded-[8px] border border-solid border-white/10 hover:bg-white/5 transition-colors bg-white/5 sm:bg-transparent cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                <span className="text-center">{t.onboarding.wizard.footer.goBack}</span>
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={isTransitioning}
              className="px-[12px] sm:px-[16px] w-auto min-w-[96px] sm:min-w-[108px] h-[30px] sm:h-[36px] flex items-center justify-center text-[12px] sm:text-[14px] leading-none text-white font-semibold rounded-[8px] sm:rounded-[10px] bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] hover:brightness-110 shadow-[0_4px_10px_rgba(59,130,246,0.3)] transition-all border-none cursor-pointer gap-[4px] sm:gap-[8px] disabled:opacity-50"
            >
              <span>{isLastStep ? t.onboarding.wizard.footer.explore : t.onboarding.wizard.footer.continue}</span>
              {!isLastStep && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 sm:ml-0">
                  <path d="M3.5 1.5L7 5L3.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox — fullscreen GIF zoom */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxSrc.title}
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxSrc(null) }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-colors z-[201] border-none cursor-pointer"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div
            className="relative w-[90vw] max-w-5xl h-[80vh] rounded-xl overflow-hidden cursor-default bg-[#1e293b] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightboxSrc.src}
              alt={lightboxSrc.title}
              fill
              unoptimized
              sizes="90vw"
              className="object-contain"
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-[12px]">
            ESC to close
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

