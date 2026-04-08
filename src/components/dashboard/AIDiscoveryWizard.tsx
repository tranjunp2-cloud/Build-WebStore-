'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'

import { useI18n } from '@/i18n'

export function AIDiscoveryWizard({ userId }: { userId?: number | string }) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  const WIZARD_STEPS = [
    {
      title: t.onboarding.wizard.slides.editor.title,
      description: t.onboarding.wizard.slides.editor.description,
      icon: "/images/f06/wizard/placeholder-icon.svg",
      gradient: "from-blue-500/20 to-teal-400/20"
    },
    {
      title: t.onboarding.wizard.slides.content.title,
      description: t.onboarding.wizard.slides.content.description,
      icon: "/images/f06/wizard/placeholder-icon-2.svg",
      gradient: "from-teal-400/20 to-blue-500/20"
    },
    {
      title: t.onboarding.wizard.slides.seo.title,
      description: t.onboarding.wizard.slides.seo.description,
      icon: "/images/f06/wizard/placeholder-icon-3.svg",
      gradient: "from-blue-500/20 via-teal-400/20 to-blue-500/20"
    }
  ]

  // Swipe handling logic
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  if (!isOpen) return null

  const stepData = WIZARD_STEPS[currentStep]
  const isLastStep = currentStep === WIZARD_STEPS.length - 1

  const dismissWizard = () => {
    // Close immediately (optimistic) — don't block UI waiting for API
    setIsOpen(false)

    // Persist to DB in background (fire-and-forget)
    if (userId) {
      fetch('/api/user/dismiss-wizard', {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        console.error('Failed to persist wizard dismiss state', error)
      })
    }
  }

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1)
    } else {
      dismissWizard()
    }
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

    if (isLeftSwipe) {
      handleNext()
    } else if (isRightSwipe) {
      if (currentStep > 0) {
        setCurrentStep(prev => prev - 1)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/60 backdrop-blur-[2px] p-6 sm:p-4">
      {/* Modal Container */}
      <div
        className="relative w-full max-w-[340px] sm:max-w-[672px] h-auto max-h-[92vh] bg-[#0F172A]/95 border border-solid border-white/10 rounded-[24px] shadow-[0_0_40px_rgba(59,130,246,0.15)] flex flex-col sm:overflow-hidden touch-pan-y backdrop-blur-xl shrink-0"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-7 pb-5 sm:px-8 sm:py-6 gap-4">
          <h2 className="text-[18px] sm:text-[24px] font-bold text-[#F8FAFC] tracking-tight leading-[1.4] max-w-[180px] sm:max-w-none">
            {t.onboarding.wizard.title}
          </h2>
          <button
            onClick={dismissWizard}
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

          {/* Top: Media Showcase */}
          <div className={`w-[260px] max-w-full aspect-square sm:aspect-auto sm:w-full sm:max-w-none sm:h-[320px] rounded-[16px] bg-gradient-to-br ${stepData.gradient} flex flex-col items-center justify-center p-4 sm:p-6 text-center mx-auto sm:mx-0 border border-white/5 shrink-0`}>
            <div className="w-[80px] h-[80px] rounded-[16px] bg-[#0F172A] flex items-center justify-center mb-4 border border-solid border-white/5 shadow-inner shrink-0 overflow-hidden drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
              <Image src={stepData.icon} alt="Feature Illustration" width={80} height={80} className="w-full h-full opacity-100 object-cover" />
            </div>
            <p className="text-[#F8FAFC]/30 text-[10px] sm:text-[12px] font-mono mb-1.5 sm:mb-1 tracking-wider uppercase leading-snug shrink-0">[GIF/Video Illustration]</p>
            <p className="text-[#F8FAFC]/20 text-[10px] sm:text-[12px] font-mono uppercase leading-snug tracking-widest shrink-0">Max 500KB</p>
          </div>

          {/* Bottom: Text & Pagination */}
          <div className="flex flex-col items-center text-center shrink-0">
            <h3 className="text-[18px] sm:text-[24px] font-bold text-[#F8FAFC] tracking-tight leading-snug m-0 mb-3 sm:mb-4">
              {stepData.title}
            </h3>
            <p className="text-[13px] sm:text-[16px] leading-[1.6] sm:leading-[1.625] text-[#64748B] max-w-[260px] sm:max-w-[576px] m-0 mb-6 sm:mb-8 min-h-[60px] sm:min-h-[52px]">
              {stepData.description}
            </p>

            {/* Dots */}
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
        </div>

        {/* Footer Divider Line */}
        <hr className="w-full border-t border-white/5 m-0" />

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between px-6 py-5 sm:py-6 mt-auto sm:mt-0 gap-4 sm:gap-0 shrink-0">

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
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 min-w-[80px] sm:min-w-[104px] h-[30px] sm:h-[36px] text-[12px] sm:text-[14px] leading-none font-medium text-[#F8FAFC] rounded-[8px] border border-solid border-white/10 hover:bg-white/5 transition-colors bg-white/5 sm:bg-transparent cursor-pointer flex items-center justify-center"
              >
                <span className="text-center">{t.onboarding.wizard.footer.goBack}</span>
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-[12px] sm:px-[16px] w-auto min-w-[96px] sm:min-w-[108px] h-[30px] sm:h-[36px] flex items-center justify-center text-[12px] sm:text-[14px] leading-none text-white font-semibold rounded-[8px] sm:rounded-[10px] bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] hover:brightness-110 shadow-[0_4px_10px_rgba(59,130,246,0.3)] transition-all border-none cursor-pointer gap-[4px] sm:gap-[8px]"
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
    </div>
  )
}

