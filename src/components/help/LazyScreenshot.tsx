'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Camera } from 'lucide-react'
import { useI18n } from '@/i18n'

interface LazyScreenshotProps {
  src: string
  alt: string
  title: string
  aspectRatio?: string
  onClick?: () => void
}

export function LazyScreenshot({
  src,
  alt,
  title,
  aspectRatio = '16/9',
  onClick
}: LazyScreenshotProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const { t, ti } = useI18n()
  // QA TC-F20.11: Định hình chiếm dụng vùng nhớ khung Skeleton Aspect-Ratio để không làm CLS (Cumulative Layout Shift)
  return (
    <div 
      className={`group relative w-full cursor-pointer overflow-hidden rounded-md border border-[#1F2937] bg-[#1F2937] transition-all duration-250 hover:border-blue-500 hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.6)] ${hasError ? 'h-[200px]' : ''}`}
      style={hasError ? {} : { aspectRatio }}
      onClick={onClick}
    >
      {/* Fallback khi Image die link (Error) */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#9CA3AF]">
          <span className="text-[32px] leading-none mb-1">📷</span>
          <span className="text-[13px] font-medium opacity-80 decoration-0">{ti(t.help.modules.lazyScreenshot.screenshot, { title })}</span>
        </div>
      ) : (
        <>
          {/* Skeleton Loading State */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1F2937] animate-pulse">
              <Camera className="w-8 h-8 text-[#9CA3AF] opacity-30" />
              <span className="text-[13px] text-[#9CA3AF] opacity-50">{title}</span>
            </div>
          )}

          {/* QA TC-F20.11b: Tự động dùng WebP & loading="lazy" do Next/Image xử lý mặt trong */}
          <Image
            src={src}
            alt={alt}
            fill
            className={`object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100 group-hover:scale-[1.01]'}`}
            sizes="(max-width: 768px) 100vw, 800px"
            quality={80} // Optimize size
            onLoadingComplete={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
          />
        </>
      )}

      {/* Zoom Hint Overlay */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] px-2 py-1 rounded opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex items-center gap-1">
        {t.help.modules.lazyScreenshot.clickToZoom}
      </div>
    </div>
  )
}
