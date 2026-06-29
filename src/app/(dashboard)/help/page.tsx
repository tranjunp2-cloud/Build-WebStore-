'use client';

import Link from 'next/link';
import { BarChart3, Bot, PenLine, Settings, ArrowUpRight, Mail } from 'lucide-react';
import { useI18n } from '@/i18n';

export default function GuidelinePage() {
  const { t } = useI18n();

  // Each feature card links directly to its module (href matches the dashboard sidebar)
  const features = [
    {
      Icon: BarChart3,
      title: t.help.overview.features.dashboardTitle,
      desc: t.help.overview.features.dashboardDesc,
      href: '/dashboard'
    },
    {
      Icon: Bot,
      title: t.help.overview.features.aiBuilderTitle,
      desc: t.help.overview.features.aiBuilderDesc,
      href: '/editor'
    },
    {
      Icon: PenLine,
      title: t.help.overview.features.blogTitle,
      desc: t.help.overview.features.blogDesc,
      href: '/blog'
    },
    {
      Icon: Settings,
      title: t.help.overview.features.settingsTitle,
      desc: t.help.overview.features.settingsDesc,
      href: '/settings'
    }
  ];

  return (
    // PANEL: OVERVIEW — bg:card, border:1px border, border-radius:12px, padding:24px
    <div className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.5)] p-6">
      <div className="flex flex-col gap-[17px]">

        {/* Section 1: Welcome */}
        <div className="flex flex-col gap-[8px]">
          <h2 className="text-[24px] font-bold text-white leading-[32px] m-0 p-0 tracking-tight">
            {t.help.overview.welcomeTitle}
          </h2>
          <p className="text-[14px] font-normal text-[hsl(var(--muted-foreground))] leading-[22px] m-0 p-0">
            {t.help.overview.welcomeDesc}
          </p>
        </div>

        {/* Section 2: Key Features */}
        <div className="flex flex-col gap-[12px]">
          <div className="pt-[8px]">
            {/* Sub-title: smaller than the main Welcome title for clearer hierarchy */}
            <h3 className="text-[18px] font-bold text-white leading-[24px] m-0 p-0 tracking-tight">
              {t.help.overview.featuresTitle}
            </h3>
          </div>

          {/* Single row of 4 cards on desktop (lg). Tablet 2-up, mobile stacked.
              Vertical layout + larger padding gives each card more breathing room. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
            {features.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={[
                  'group relative flex flex-row items-start gap-[12px] p-[20px]',
                  'bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-[8px]',
                  'transition-colors duration-200',
                ].join(' ')}
              >
                {/* Affordance: arrow hints the card is a link to the feature */}
                <ArrowUpRight
                  className="absolute top-[16px] right-[16px] w-4 h-4 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] transition-colors"
                  aria-hidden
                />
                {/* Icon box: 40x40, bg:card, centered — matches demo .feature-icon */}
                <div
                  className="flex items-center justify-center rounded-[8px] bg-[hsl(var(--card))] shadow-[0_1px_3px_0_rgba(0,0,0,0.5)] shrink-0 text-[hsl(var(--primary))]"
                  style={{ width: 40, height: 40 }}
                  aria-hidden="true"
                >
                  <item.Icon className="w-6 h-6" />
                </div>
                {/* Text group (pr-5 keeps copy clear of the arrow) */}
                <div className="flex flex-col gap-[4px] flex-1 min-w-0 pr-5">
                  <h4 className="text-[14px] font-semibold text-white leading-[22px] m-0 p-0 tracking-tight group-hover:text-[hsl(var(--primary))] transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[12px] font-normal text-[hsl(var(--muted-foreground))] leading-[18px] m-0 p-0">
                    {item.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section 3: Need more help — distinct support card with a clear email CTA */}
        <div className="flex flex-col gap-[8px]">
          <div className="pt-[8px]">
            {/* Sub-title: smaller than the main Welcome title for clearer hierarchy */}
            <h3 className="text-[18px] font-bold text-white leading-[24px] m-0 p-0 tracking-tight">
              {t.help.overview.needHelpTitle}
            </h3>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.4)] p-[16px]">
            <p className="text-[14px] font-normal text-[hsl(var(--muted-foreground))] leading-[22px] m-0 p-0">
              {t.help.overview.needHelpDesc}
            </p>
            <a
              href="mailto:support@echprime.com"
              className="inline-flex shrink-0 items-center gap-2 rounded-[8px] bg-[hsl(var(--primary))] px-4 py-2 text-[14px] font-semibold !text-white transition-colors hover:bg-[hsl(var(--primary)/0.9)]"
            >
              <Mail className="w-4 h-4 shrink-0" aria-hidden />
              support@echprime.com
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
