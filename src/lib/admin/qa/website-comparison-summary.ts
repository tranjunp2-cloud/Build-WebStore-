import { effectiveFieldStatus } from './website-migration-status';
import type { MigrationField, MigrationPage } from './website-migration-compare';

export type WebsiteComparisonSummary = {
  total: number; matched: number; mismatched: number; unverified: number;
  percentage: number | null;
};
export type WebsiteImageCheck = Parameters<typeof effectiveFieldStatus>[3][number];
export type WebsiteImageReview = Parameters<typeof effectiveFieldStatus>[4][number];

/** Content parity only; audit/visual acceptance and BE commerce evidence remain separate. */
export function summarizeWebsiteComparison(
  detail: { evidence: string; settings: MigrationField[]; pages: MigrationPage[] },
  checks: WebsiteImageCheck[] = [], reviews: WebsiteImageReview[] = [],
): WebsiteComparisonSummary {
  const result: WebsiteComparisonSummary = { total: 0, matched: 0, mismatched: 0, unverified: 0, percentage: null };
  if (detail.evidence !== 'available' || !detail.pages.length) return result;
  const add = (status: MigrationField['status']) => {
    result.total++;
    if (status === 'match') result.matched++;
    else if (status === 'mismatch') result.mismatched++;
    else result.unverified++;
  };
  detail.settings.forEach(field => add(effectiveFieldStatus(field, '', '', checks, reviews)));
  for (const page of detail.pages) {
    page.fields.forEach(field => add(page.destinationId ? field.status : 'unverified'));
    for (const block of page.blocks) {
      if (!page.destinationId || !block.indexes.length || !block.fields.length) {
        // Missing mappings must not disappear from the denominator.
        add('unverified');
        continue;
      }
      block.fields.forEach(field => add(effectiveFieldStatus(field, page.sourceId, block.sourceId, checks, reviews)));
    }
  }
  if (result.total) result.percentage = result.matched === result.total ? 100 : Math.min(99.9, Math.round(result.matched / result.total * 1000) / 10);
  return result;
}
