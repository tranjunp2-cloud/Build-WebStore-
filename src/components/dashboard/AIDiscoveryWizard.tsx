'use client'

import { useState } from 'react'
import Image from 'next/image'

const WIZARD_STEPS = [
  {
    title: "AI Editor",
    description: "Edit website interfaces through chat - no coding required. AI understands your requests and automatically updates the design in real-time.",
    icon: "/images/f06/wizard/placeholder-icon.svg",
    gradient: "from-blue-500/20 to-teal-400/20"
  },
  {
    title: "AI Content",
    description: "Create product descriptions, automatically generate SEO blog posts. AI writes professional content that attracts customers and is optimized for search engines.",
    icon: "/images/f06/wizard/placeholder-icon-2.svg",
    gradient: "from-teal-400/20 to-blue-500/20"
  },
  {
    title: "AI SEO",
    description: "Automatically optimize your website to improve search rankings. AI analyzes and enhances SEO, making your website easier to find on Google.",
    icon: "/images/f06/wizard/placeholder-icon-3.svg",
    gradient: "from-blue-500/20 via-teal-400/20 to-blue-500/20"
  }
]

export function AIDiscoveryWizard({ userId }: { userId?: number | string }) {
  const [isOpen, setIsOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  // Swipe handling logic
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  if (!isOpen) return null

  const stepData = WIZARD_STEPS[currentStep]
  const isLastStep = currentStep === WIZARD_STEPS.length - 1

  const dismissWizard = async () => {
    setIsOpen(false)
    if (userId) {
      try {
        await fetch(`/api/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ has_seen_ai_wizard: true })
        })
      } catch (error) {
        console.error('Failed to update wizard state', error)
      }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/60 backdrop-blur-[2px] sm:p-4">
      {/* Modal Container */}
      <div 
        className="relative w-full h-full sm:h-auto max-w-[672px] bg-[#0B1120] sm:border border-solid border-white/[0.08] rounded-none sm:rounded-[24px] shadow-2xl flex flex-col overflow-y-auto sm:overflow-hidden touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6">
          <h2 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-2 tracking-tight">
            ✨ Discover the Power of AI
          </h2>
          <button 
            onClick={dismissWizard}
            className="flex-shrink-0 hover:opacity-80 transition-opacity bg-transparent border-none p-0 m-0 cursor-pointer"
            aria-label="Close"
          >
            <Image src="/images/f06/wizard/close-btn.svg" alt="Close" width={32} height={32} className="w-8 h-8" />
          </button>
        </div>

        {/* Header Divider Line */}
        <hr className="w-full border-t border-white/[0.08]" />

        {/* Content Area */}
        <div className="flex flex-col items-center pt-10 px-8 pb-0">
          
          {/* Top: Media Showcase */}
          <div className={`w-full h-[320px] rounded-[16px] bg-gradient-to-br ${stepData.gradient} flex flex-col items-center justify-center p-6 text-center shadow-inner mb-8`}>
             <div className="w-[64px] h-[64px] rounded-[16px] bg-slate-800/80 flex items-center justify-center mb-5 border border-solid border-white/5">
                <Image src={stepData.icon} alt="Feature Illustration" width={32} height={32} className="w-[32px] h-[32px]" />
             </div>
             <p className="text-slate-300 text-[12px] font-mono mb-1 tracking-wide opacity-40">[GIF/Video Illustration]</p>
             <p className="text-slate-300 text-[12px] font-mono opacity-30">Max 500KB</p>
          </div>

          {/* Bottom: Text & Pagination */}
          <div className="flex flex-col items-center text-center">
            <h3 className="text-2xl font-bold text-[#F8FAFC] mb-4 tracking-tight">
              {stepData.title}
            </h3>
            <p className="text-[16px] leading-[1.625] text-slate-500 max-w-[576px] mb-8 min-h-[52px]">
              {stepData.description}
            </p>
            
            {/* Dots */}
            <div className="flex items-center justify-center gap-2 mb-10">
              {WIZARD_STEPS.map((_, idx) => (
                <div 
                  key={idx}
                  className={`rounded-full transition-all duration-300 ${
                    idx === currentStep 
                      ? "w-8 h-2 bg-blue-500" 
                      : "w-2 h-2 bg-slate-100/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer Divider Line */}
        <hr className="w-full border-t border-white/[0.08]" />

        {/* Footer */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-6 mt-auto sm:mt-0 pb-10 sm:pb-6">
          <button 
            onClick={dismissWizard}
            className="text-[14px] font-medium text-[#F8FAFC]/60 hover:text-white transition-colors bg-transparent border-none p-0 m-0 cursor-pointer hidden sm:block"
          >
            {isLastStep ? "Skip the guide" : "Skip instructions"}
          </button>
          
          <button 
            onClick={dismissWizard}
            className="text-[14px] font-medium text-[#F8FAFC]/60 hover:text-white transition-colors bg-transparent border-none p-0 m-0 cursor-pointer sm:hidden"
          >
            Skip
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {currentStep > 0 && (
              <button 
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-3 sm:px-4 py-3 sm:py-2 text-[14px] font-medium text-[#F8FAFC] rounded-[10px] sm:border border-solid border-white/[0.08] hover:bg-white/[0.04] transition-colors bg-white/5 sm:bg-transparent cursor-pointer hidden sm:block"
              >
                ← Go back
              </button>
            )}
            <button 
              onClick={handleNext}
              className="flex items-center justify-center rounded-[12px] sm:rounded-[10px] bg-gradient-to-r from-blue-500 to-teal-400 px-6 sm:px-5 py-3 sm:py-2 min-h-[44px] sm:min-h-[36px] text-white text-[15px] sm:text-[14px] font-semibold hover:brightness-110 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),_0_10px_15px_-3px_rgba(0,0,0,0.1)] transition-all border-none cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {isLastStep ? "Explore CMS" : "Continue"}
                {!isLastStep && <Image src="/images/f06/wizard/continue-icon.svg" alt="Arrow Right" width={14} height={14} className="w-[14px] h-[14px] hidden sm:block" />}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

