import { describe, expect, it } from 'vitest';
import { summarizeWebsiteComparison } from '@/lib/admin/qa/website-comparison-summary';
import { classifyMigrationReport } from '@/lib/admin/qa/migration-report-status';
import type { MigrationField, MigrationPage, MigrationStore } from '@/lib/admin/qa/website-migration-compare';
const field = (status: MigrationField['status']): MigrationField => ({ field: 'headline', source: 'Title', current: 'Title', status });
const page = (fields: MigrationField[]): MigrationPage => ({ sourceId: '1', title: 'Home', destinationId: 1, url: '/', fields: [], blocks: [{ sourceId: 'footer', kind: 'footer', indexes: [1], fields, sourceContent: [], status: 'match' }], audit: null });
const detail = (fields: MigrationField[]) => ({ evidence: 'available', settings: [], pages: [page(fields)] });

describe('[TC-F40-MIG-WEB-RATE-01] Website content percentage', () => {
  it('includes unverified fields in the denominator, independent of BE evidence', () => {
    const result = summarizeWebsiteComparison(detail([field('match'), field('match'), field('mismatch'), field('unverified')]));
    expect(result).toEqual({ total: 4, matched: 2, mismatched: 1, unverified: 1, percentage: 50 });
  });
  it('keeps absent website evidence nullable instead of displaying false zero', () => {
    expect(summarizeWebsiteComparison({ ...detail([]), evidence: 'unverified' }).percentage).toBeNull();
    expect(summarizeWebsiteComparison({ evidence: 'available', settings: [], pages: [] }).percentage).toBeNull();
  });
  it('does not round incomplete comparisons to 100 percent', () => {
    const result = summarizeWebsiteComparison(detail([...Array.from({ length: 1999 }, () => field('match')), field('unverified')]));
    expect(result.percentage).toBe(99.9);
  });
  it('does not drop unmapped blocks from the denominator', () => {
    const input = detail([field('match')]);
    input.pages[0].blocks.push({ sourceId: 'missing', kind: 'hero', indexes: [], sourceContent: [], fields: [], status: 'unverified' });
    expect(summarizeWebsiteComparison(input).percentage).toBe(50);
  });
  it('counts image approval only for its exact field identity', () => {
    const image: MigrationField = { field: 'logo', source: JSON.stringify({ url: 'https://source.test/logo.png' }), current: JSON.stringify({ id: 1, url: 'https://target.test/logo.png' }), status: 'mismatch' };
    const review = { page: '1', block: 'footer', field: 'logo', path: '$' };
    expect(summarizeWebsiteComparison(detail([image])).unverified).toBe(1);
    expect(summarizeWebsiteComparison(detail([image]), [], [review]).percentage).toBe(100);
    expect(summarizeWebsiteComparison(detail([image]), [], [{ ...review, page: 'old-page' }]).percentage).toBe(0);
  });
  it('uses website evidence for the report even when BE evidence is absent', () => {
    const websiteComparison = summarizeWebsiteComparison(detail([field('match')]));
    const store: MigrationStore = { storeId: '1', name: 'Fixture', siteId: 1, migration: 'completed', publish: 'published', auditStatus: 'checked', errors: 0, warnings: 0, checkedAt: '2026-10-06T00:00:00Z', url: '/', updatedAt: '2026-10-01T00:00:00Z', pageCount: 1, qcStatus: 'unverified', reviewedAt: null, fieldEvidence: null, websiteComparison };
    expect(classifyMigrationReport(store).status).toBe('review');
    expect(classifyMigrationReport(store).reasons.join(' ')).not.toContain('Chưa có field evidence');
  });
});
