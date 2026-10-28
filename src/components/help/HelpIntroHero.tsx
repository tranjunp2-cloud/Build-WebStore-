'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import { V2IntroVideo } from '@/components/dashboard/V2IntroVideo';

/**
 * Help Center Overview "Welcome" hero (US-F20-05): its own card spanning the same width as the Key features grid, copy
 * pinned left and the V2 intro video pinned right (capped at 480px) from xl, stacked below. Same player + media as the
 * onboarding popup; watching here never touches onboarding state.
 */
export function HelpIntroHero() {
  const { t } = useI18n();
  const overview = t.help.overview;
  const intro = overview.intro;
  const [duration, setDuration] = useState(0);

  // Whole minutes for the lead line ("1-minute" singular); 2 until metadata arrives
  const minutes = duration > 0 ? Math.max(1, Math.round(duration / 60)) : 2;
  const lead = minutes === 1 ? intro.lead1 : intro.leadN.replace('{n}', String(minutes));

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-solid border-white/5 bg-[hsl(var(--secondary)/0.4)] p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between xl:gap-12">
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <h2 className="m-0 p-0 text-2xl font-semibold tracking-tight text-[var(--dash-text)] sm:text-3xl [text-wrap:balance]">
          {overview.welcomeTitle}
        </h2>
        <p className="m-0 mt-2.5 p-0 text-[14px] leading-[1.6] text-slate-400 [text-wrap:pretty]">{intro.desc}</p>
        <p className="m-0 mt-5 p-0 text-[14px] font-semibold leading-[22px] text-[var(--dash-text)]">{lead}</p>
        <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {intro.points.map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-[14px] leading-[22px] text-[var(--dash-text)]">
              <Check className="mt-0.5 size-[18px] flex-none text-teal-400" strokeWidth={2.5} aria-hidden />
              <span className="min-w-0">{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full min-w-0 max-w-[640px] xl:w-[480px] xl:max-w-[480px] xl:flex-none">
        <V2IntroVideo variant="inline" onDurationChange={setDuration} />
      </div>
    </section>
  );
}
