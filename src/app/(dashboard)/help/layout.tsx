import { ReactNode } from 'react'
import { HelpCenterNav } from '@/components/help/HelpCenterNav'
import { HelpCenterHeader } from '@/components/help/HelpCenterHeader'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Learn how to use your online store management system.'
}

export default function HelpCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1660px] mx-auto w-full">
      <HelpCenterHeader />
      
      <div className="w-full">
        <HelpCenterNav />
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  )
}
