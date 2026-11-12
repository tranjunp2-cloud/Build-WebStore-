'use client'

import { useRef } from 'react'
import { useI18n } from '@/i18n'
import './landing-v2.css'
import { LandingNav } from './landing-nav'
import { LandingHero } from './landing-hero'
import { HowItWorks } from './how-it-works'
import { FeaturesBento } from './features-bento'
import { ProductTour } from './product-tour'
import { TemplatesCarousel } from './templates-carousel'
import { FaqSection } from './faq-section'
import { FinalCta } from './final-cta'
import { LandingFooter } from './landing-footer'
import { useLandingMotion } from './use-landing-motion'
import { useLandingTemplates } from './use-landing-templates'
import { useLandingTheme } from './use-landing-theme'

/**
 * Landing v2 (F45) — marketing home page. All styles live under `.lv` (landing-v2.css) so they cannot leak into
 * the dashboard after client navigation. Copy comes from the `landingV2` i18n namespace (EN / BM).
 */
export function LandingV2() {
  const { t, locale, setLocale } = useI18n()
  const copy = t.landingV2
  const rootRef = useRef<HTMLDivElement>(null)
  const { theme, toggleTheme } = useLandingTheme()
  const templates = useLandingTemplates()
  useLandingMotion(rootRef)

  const toggleLang = () => setLocale(locale === 'en' ? 'ms' : 'en')

  return (
    <div ref={rootRef} className="lv" data-theme={theme} data-testid="landing-v2">
      <a className="skip" href="#main">{copy.nav.skip}</a>
      <LandingNav copy={copy} theme={theme} onToggleTheme={toggleTheme} onToggleLang={toggleLang} />
      <main id="main">
        <LandingHero copy={copy} />
        <HowItWorks copy={copy} />
        <FeaturesBento copy={copy} locale={locale} tpl={templates} />
        <ProductTour copy={copy} />
        <TemplatesCarousel copy={copy} tpl={templates} />
        <FaqSection copy={copy} />
        <FinalCta copy={copy} />
      </main>
      <LandingFooter copy={copy} onToggleLang={toggleLang} />
    </div>
  )
}
