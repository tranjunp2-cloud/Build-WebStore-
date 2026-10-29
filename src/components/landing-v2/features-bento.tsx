import { SectionHead } from './section-head'
import { BentoCardsBuild } from './bento-cards-build'
import { BentoCardsGrow } from './bento-cards-grow'
import { BENTO_PREVIEW_CATEGORIES, firstOfCategory } from './template-picks'
import type { LandingTemplatesState } from './use-landing-templates'
import type { LvCopy } from './lv-types'

/** Section #features: 10-card bento. Cards 1 and 8 show live template previews (restaurant / tech, beauty, real estate). */
export function FeaturesBento({ copy, locale, tpl }: { copy: LvCopy; locale: 'en' | 'ms'; tpl: LandingTemplatesState }) {
  const { feat: f, mock: x } = copy
  const loading = tpl.status === 'loading'
  const previews = BENTO_PREVIEW_CATEGORIES.map((c) => firstOfCategory(tpl.templates, c))
  return (
    <section data-sec="features" id="features" className="sec">
      <div className="wrap">
        <SectionHead label={f.label} title={f.title} sub={f.sub} />
        <div className="bento">
          <BentoCardsBuild f={f} x={x} heroTemplate={firstOfCategory(tpl.templates, 'restaurant')} loading={loading} />
          <BentoCardsGrow f={f} x={x} locale={locale} previews={previews} loading={loading} />
        </div>
      </div>
    </section>
  )
}
