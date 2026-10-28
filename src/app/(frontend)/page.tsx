import type { Metadata } from 'next'
import { LandingV2 } from '@/components/landing-v2/landing-v2'
import { V2_INTRO_MEDIA } from '@/components/dashboard/v2-intro-media'

const TITLE = 'Web Store — AI website & online store builder'
const DESCRIPTION =
  'Describe your business and AI builds your online store. Take payments, ship orders and manage everything from one dashboard, in English or Bahasa Melayu.'
const OG_DESCRIPTION = 'Describe your business. AI builds your online store.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [{ url: V2_INTRO_MEDIA.posterJpg, width: V2_INTRO_MEDIA.posterWidth, height: V2_INTRO_MEDIA.posterHeight }],
  },
}

export default function HomePage() {
  return <LandingV2 />
}
