'use client';

import { BarChart3, Bot, PenLine, Settings } from 'lucide-react';
import { useI18n } from '@/i18n';

export default function GuidelinePage() {
  const { t } = useI18n();

  const features = [
    {
      Icon: BarChart3,
      title: t.help.overview.features.dashboardTitle,
      desc: t.help.overview.features.dashboardDesc
    },
    {
      Icon: Bot,
      title: t.help.overview.features.aiBuilderTitle,
      desc: t.help.overview.features.aiBuilderDesc
    },
    {
      Icon: PenLine,
      title: t.help.overview.features.blogTitle,
      desc: t.help.overview.features.blogDesc
    },
    {
      Icon: Settings,
      title: t.help.overview.features.settingsTitle,
      desc: t.help.overview.features.settingsDesc
    }
  ];

  return (
    // PANEL: OVERVIEW — bg:#161E2E, border:1px #1F2937, border-radius:12px, padding:24px
    <div className="w-full bg-[#161E2E] border border-[#1F2937] rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.5)] p-6">
      <div className="flex flex-col gap-[17px]">

        {/* Section 1: Welcome */}
        <div className="flex flex-col gap-[8px]">
          <h2 className="text-[24px] font-bold text-white leading-[32px] m-0 p-0 tracking-tight">
            {t.help.overview.welcomeTitle}
          </h2>
          <p className="text-[14px] font-normal text-[#9CA3AF] leading-[22px] m-0 p-0">
            {t.help.overview.welcomeDesc}
          </p>
        </div>

        {/* Section 2: Key Features */}
        <div className="flex flex-col gap-[12px]">
          <div className="pt-[8px]">
            <h3 className="text-[20px] font-bold text-white leading-[26px] m-0 p-0 tracking-tight">
              {t.help.overview.featuresTitle}
            </h3>
          </div>

          {/*
            HTML demo: grid auto-fill minmax(280px, 1fr) — responsive without hard column counts.
            Mobile (<sm): 1 col stacked.
          */}
          <div
            className="grid gap-[16px]"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {features.map((item) => (
              <div
                key={item.title}
                className={[
                  'flex flex-row items-start gap-[12px] p-[16px]',
                  'bg-[#1F2937] border border-[#1F2937] rounded-[8px]',
                  'shadow-[0_1px_3px_0_rgba(0,0,0,0.5)]',
                  'transition-all duration-200 cursor-default',
                  'hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.6)]',
                ].join(' ')}
              >
                {/* Icon box: 40x40, bg:#161E2E, centered — matches demo .feature-icon */}
                <div
                  className="flex items-center justify-center rounded-[8px] bg-[#161E2E] shadow-[0_1px_3px_0_rgba(0,0,0,0.5)] shrink-0 text-blue-400"
                  style={{ width: 40, height: 40 }}
                  aria-hidden="true"
                >
                  <item.Icon className="w-6 h-6" />
                </div>
                {/* Text group */}
                <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                  <h4 className="text-[14px] font-semibold text-white leading-[22px] m-0 p-0 tracking-tight">
                    {item.title}
                  </h4>
                  <p className="text-[12px] font-normal text-[#9CA3AF] leading-[18px] m-0 p-0">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Need more help */}
        <div className="flex flex-col gap-[8px]">
          <div className="pt-[8px]">
            <h3 className="text-[20px] font-bold text-white leading-[26px] m-0 p-0 tracking-tight">
              {t.help.overview.needHelpTitle}
            </h3>
          </div>
          <p className="text-[16px] font-normal text-[#9CA3AF] leading-[24px] m-0 p-0">
            {t.help.overview.needHelpDesc}
            <a
              href="mailto:support@echprime.com"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              support@echprime.com
            </a>
            .
          </p>
        </div>

      </div>
    </div>
  )
}
