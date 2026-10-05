import { describe, expect, it } from 'vitest';
import { classifyMigrationReport } from '@/lib/admin/qa/migration-report-status';
import type { MigrationStore } from '@/lib/admin/qa/website-migration-compare';
import type { FieldEvidenceSummary } from '@/lib/admin/qa/field-evidence-summary';

function evidence(): FieldEvidenceSummary {
  return {
    generationId: 'fixture-generation', runId: 'fixture-run', digest: 'fixture-digest',
    verifiedAt: '2026-10-01T00:00:00Z', sourceSnapshotAt: '2026-09-30T00:00:00Z',
    counts: { match: 10, mismatch: 0, missing: 0, duplicate: 0, unsupported: 0, unverified: 0 },
    outsideScope: 0, outsideComparison: 0, openExceptions: 0,
  };
}
function store(overrides: Partial<MigrationStore> = {}): MigrationStore {
  return {
    storeId: 'fixture-source', name: 'Fixture', siteId: 123, migration: 'completed',
    publish: 'published', auditStatus: 'checked', errors: 0, warnings: 0,
    checkedAt: '2026-10-02T00:00:00Z', url: '/sites/fixture', updatedAt: '2026-10-01T00:00:00Z',
    pageCount: 1, qcStatus: 'unverified', reviewedAt: null, fieldEvidence: evidence(), ...overrides,
  };
}

describe('[TC-F40-MIG-REPORT-01] Automatic migration report', () => {
  it('never treats all available fields matching as complete website acceptance', () => {
    // Arrange
    const input = store();
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('review');
    expect(result.reasons.join(' ')).toContain('phạm vi nghiệm thu');
  });
  it.each(['passed', 'failed', 'warning'] as const)('keeps manual QC %s separate from automatic result', qcStatus => {
    // Arrange
    const input = store({ qcStatus, fieldEvidence: null });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('insufficient');
  });
  it.each(['mismatch', 'missing', 'duplicate'] as const)('prioritizes proven %s over stale audit and incomplete evidence', key => {
    // Arrange
    const fields = evidence();
    fields.counts[key] = 1;
    fields.counts.unsupported = 5;
    const input = store({ auditStatus: 'stale', fieldEvidence: fields });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('failed');
    expect(result.reasons.length).toBeGreaterThan(1);
  });
  it('reports migration failure even without field evidence', () => {
    // Arrange
    const input = store({ migration: 'failed', fieldEvidence: null });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('failed');
    expect(result.reasons[0]).toContain('Migration thất bại');
  });
  it('reports current audit errors as failed', () => {
    // Arrange
    const input = store({ auditStatus: 'needs-fix', errors: 2 });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('failed');
  });
  it.each(['stale', 'historical'])('does not label %s audit errors as current failures', auditStatus => {
    // Arrange
    const input = store({ auditStatus, errors: 5, fieldEvidence: null });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('review');
    expect(result.reasons[0]).toContain('Audit đã cũ');
  });
  it('requires recheck when a previous QC verdict has become unverified', () => {
    // Arrange
    const input = store({ reviewedAt: '2026-09-30T00:00:00Z' });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('review');
    expect(result.reasons[0]).toContain('QC trước');
  });
  it.each(['unsupported', 'unverified'] as const)('keeps %s fields insufficient', key => {
    // Arrange
    const fields = evidence();
    fields.counts[key] = 1;
    // Act
    const result = classifyMigrationReport(store({ fieldEvidence: fields }));
    // Assert
    expect(result.status).toBe('insufficient');
  });
  it.each(['outsideScope', 'outsideComparison'] as const)('does not hide %s fields from acceptance', key => {
    // Arrange
    const fields = evidence();
    fields[key] = 1;
    // Act
    const result = classifyMigrationReport(store({ fieldEvidence: fields }));
    // Assert
    expect(result.status).toBe('insufficient');
  });
  it('keeps an empty generation insufficient', () => {
    // Arrange
    const fields = evidence();
    fields.counts.match = 0;
    // Act
    const result = classifyMigrationReport(store({ fieldEvidence: fields }));
    // Assert
    expect(result.status).toBe('insufficient');
  });
  it.each(['not-checked', 'waiting-be', 'unexpected-status'])('does not accept incomplete audit %s', auditStatus => {
    // Arrange
    const input = store({ auditStatus });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('insufficient');
  });
  it('does not accept audit with no timestamp', () => {
    // Arrange
    const input = store({ checkedAt: null });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('insufficient');
  });
  it('shows exceptions and warnings as actionable reasons without guessing severity', () => {
    // Arrange
    const fields = evidence();
    fields.openExceptions = 2;
    const input = store({ fieldEvidence: fields, warnings: 1, publish: 'draft' });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('review');
    expect(result.reasons.join(' ')).toContain('2 issue F42');
    expect(result.reasons.join(' ')).toContain('1 cảnh báo');
    expect(result.reasons.join(' ')).toContain('chưa publish');
  });
  it('keeps pending migration with no generated pages insufficient', () => {
    // Arrange
    const input = store({ migration: 'pending', pageCount: 0 });
    // Act
    const result = classifyMigrationReport(input);
    // Assert
    expect(result.status).toBe('insufficient');
    expect(result.reasons.join(' ')).toContain('Chưa có trang');
  });
});
