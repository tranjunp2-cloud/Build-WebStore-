'use client';

import { useI18n } from '@/i18n';

export function HelpCenterHeader() {
  const { t } = useI18n();
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-white mb-2">{t.help.overview.title}</h1>
      <p className="text-slate-400 text-base">
        {t.help.overview.subtitle}
      </p>
    </div>
  );
}
