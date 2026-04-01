'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import Image from 'next/image'
import { LazyScreenshot } from './LazyScreenshot'
import { X, Camera } from 'lucide-react'
import { useI18n } from '@/i18n'

export function ModuleGuidesTab() {
  const { t } = useI18n()
  
  const MODULES_DATA = [
    {
      id: 'products',
      icon: '📦',
      label: t.help.modules.data.products.label,
      steps: [
        {
          num: 1,
          title: t.help.modules.data.products.steps[0].title,
          desc: t.help.modules.data.products.steps[0].desc,
          imgSrc: '/help/products-1-list.webp',
          imgTitle: t.help.modules.data.products.steps[0].imgTitle
        },
        {
          num: 2,
          title: t.help.modules.data.products.steps[1].title,
          desc: t.help.modules.data.products.steps[1].desc,
          imgSrc: '/help/products-2-create.webp',
          imgTitle: t.help.modules.data.products.steps[1].imgTitle
        },
        {
          num: 3,
          title: t.help.modules.data.products.steps[2].title,
          desc: t.help.modules.data.products.steps[2].desc,
          imgSrc: '/help/products-3-images.webp',
          imgTitle: t.help.modules.data.products.steps[2].imgTitle
        }
      ]
    },
    {
      id: 'orders',
      icon: '🛒',
      label: t.help.modules.data.orders.label,
      steps: [
        {
          num: 1,
          title: t.help.modules.data.orders.steps[0].title,
          desc: t.help.modules.data.orders.steps[0].desc,
          imgSrc: '/help/orders-1-list.webp',
          imgTitle: t.help.modules.data.orders.steps[0].imgTitle
        },
        {
          num: 2,
          title: t.help.modules.data.orders.steps[1].title,
          desc: t.help.modules.data.orders.steps[1].desc,
          imgSrc: '/help/orders-2-detail.webp',
          imgTitle: t.help.modules.data.orders.steps[1].imgTitle
        }
      ]
    },
    {
      id: 'dashboard',
      icon: '📊',
      label: t.help.modules.data.dashboard.label,
      steps: [
        {
          num: 1,
          title: t.help.modules.data.dashboard.steps[0].title,
          desc: t.help.modules.data.dashboard.steps[0].desc,
          imgSrc: '/help/dashboard-1-overview.webp',
          imgTitle: t.help.modules.data.dashboard.steps[0].imgTitle
        }
      ]
    },
    {
      id: 'blog',
      icon: '📝',
      label: t.help.modules.data.blog.label,
      steps: [
        {
          num: 1,
          title: t.help.modules.data.blog.steps[0].title,
          desc: t.help.modules.data.blog.steps[0].desc,
          imgSrc: '/help/blog-1-create.webp',
          imgTitle: t.help.modules.data.blog.steps[0].imgTitle
        }
      ]
    },
    {
      id: 'settings',
      icon: '⚙️',
      label: t.help.modules.data.settings.label,
      steps: [
        {
          num: 1,
          title: t.help.modules.data.settings.steps[0].title,
          desc: t.help.modules.data.settings.steps[0].desc,
          imgSrc: '/help/settings-1-domains.webp',
          imgTitle: t.help.modules.data.settings.steps[0].imgTitle
        }
      ]
    }
  ]

  const [activeModule, setActiveModule] = useState<string>('products')
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null)
  
  // Ref container hooks for Anchor scrolling
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Xử lý deep Url Hash Anchor jump TC-F20.08 và TC-F20.13
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && MODULES_DATA.some(m => m.id === hash)) {
        setActiveModule(hash)
        // Delay slightly for component mounting transition before scrolling
        setTimeout(() => {
          const el = sectionRefs.current[hash]
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 150)
      }
    }

    // Trigger on initial mount
    handleHashChange()

    // Listen to hash change manually if modified
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

  // Khóa trục lướt ngầm (Lock Body Scrolling Interaction) TC-F20.17
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
             // We can't return union type normally, assign manually
             sectionRefs.current[module.id] = el
          }}
          className={`flex-col transition-opacity duration-300 ${
            activeModule === module.id ? 'flex opacity-100' : 'hidden opacity-0'
          }`}
        >
          {module.steps.map((step) => (
             // qa TC-F20.13 Cấu trúc Container Box-Shadow
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
                {typeof step.desc === 'string' ? <p dangerouslySetInnerHTML={{ __html: step.desc }} /> : step.desc}
              </div>

              {/* Lazy WebP Ảnh kèm SVG Skeleton - Next Image */}
              <LazyScreenshot
                src={step.imgSrc}
                alt={step.title}
                title={step.imgTitle}
                onClick={() => setLightboxImg({ src: step.imgSrc, title: step.imgTitle })}
              />
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
               e.stopPropagation();
               setLightboxImg(null);
             }}
             className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-colors z-[1001]"
           >
             <X className="w-5 h-5" />
           </button>
           
           {/* Prevent zoom-out click when hitting image core container */}
           <div 
             className="relative w-[90vw] max-w-6xl h-[85vh] rounded-xl overflow-hidden cursor-default touch-pan-x touch-pan-y touch-pinch-zoom bg-[#1e293b] flex items-center justify-center"
             onClick={(e) => e.stopPropagation()}
           >
             {lightboxImg.src ? (
               <Image 
                 src={lightboxImg.src}
                 alt={lightboxImg.title}
                 fill
                 className="object-contain"
                 quality={100}
                 sizes="90vw"
               />
             ) : (
               <div className="flex flex-col items-center justify-center text-[#94a3b8] w-full h-full p-6 text-center">
                  <span className="text-[48px] leading-none mb-2">🖼️</span>
                  <span className="text-[16px] font-semibold text-white drop-shadow">{lightboxImg.title}</span>
                  <span className="text-[12px] opacity-70 mt-1">{t.help.modules.tab.fullResolution}</span>
               </div>
             )}
           </div>

           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-[12px]">
             {t.help.modules.tab.escToClose}
           </div>
        </div>
      )}

    </div>
  )
}