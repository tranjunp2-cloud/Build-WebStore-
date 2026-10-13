import { describe, expect, it } from 'vitest';
import { QC_FIELD_REGISTRY, QC_FIELD_REGISTRY_HASH, QC_FIELD_REGISTRY_VERSION, F42_FIELD_EVIDENCE_CONTRACT } from '@/lib/admin/qa/f42-reader-contract';
import { F42_FIELD_SCHEMA, F42_IMAGE_CHECK_SCHEMA, F42_IMAGE_REVIEW_SCHEMA, F42_SOURCE_UNAVAILABLE, F42_WEBSITE_SCHEMA, F42SourceUnavailableError, isF42SourceUnavailable, missingF42SchemaColumns, type F42SchemaContract } from '@/lib/admin/qa/f42-source-contract';

describe('[TC-F40-MIG-LIVE-12] F42 source readiness contract', () => {
  const required: F42SchemaContract = { stores: ['id', 'status'], reviews: ['store_id'] };

  it('accepts a complete schema and ignores unrelated columns', () => {
    // Arrange
    const columns = [
      { table_name: 'stores', column_name: 'id' },
      { table_name: 'stores', column_name: 'status' },
      { table_name: 'reviews', column_name: 'store_id' },
      { table_name: 'unrelated', column_name: 'extra' },
    ];
    // Act
    const missing = missingF42SchemaColumns(columns, required);
    // Assert
    expect(missing).toEqual([]);
  });

  it('detects absent tables and partially deployed columns', () => {
    // Arrange
    const columns = [{ table_name: 'stores', column_name: 'id' }];
    // Act
    const missing = missingF42SchemaColumns(columns, required);
    // Assert
    expect(missing).toEqual(['stores.status', 'reviews.store_id']);
  });

  it('does not infer readiness from columns on another table', () => {
    // Arrange
    const columns = [{ table_name: 'reviews', column_name: 'id' }];
    // Act
    const missing = missingF42SchemaColumns(columns, required);
    // Assert
    expect(missing).toContain('stores.id');
    expect(missing).toHaveLength(3);
  });

  it('covers website QA, image caches and every field-reader table', () => {
    // Arrange
    const fieldTables = Object.keys(F42_FIELD_SCHEMA);
    // Act
    const missingBase = missingF42SchemaColumns([], F42_WEBSITE_SCHEMA);
    // Assert
    expect(missingBase).toContain('pw1_migration_qa_reviews.evidence_version');
    expect(missingBase).toContain('pw1_migration_qa_audits.base_url');
    expect(F42_IMAGE_CHECK_SCHEMA.pw1_migration_media).toContain('tenant_id');
    expect(F42_IMAGE_CHECK_SCHEMA.pw1_migration_qa_image_checks).toContain('result');
    expect(F42_IMAGE_REVIEW_SCHEMA.pw1_migration_qa_image_reviews).toContain('image_path');
    expect(fieldTables).toEqual(['migration_runs', 'migration_import_stores', 'migration_exceptions', 'migration_evidence_generations', 'migration_source_evidence_snapshots', 'migration_source_evidence_rows', 'migration_field_evidence']);
  });

  it.each(['42P01', '42703'])('recognizes a post-preflight PostgreSQL schema race (%s)', (code) => {
    // Arrange
    const error = { cause: { cause: { code, message: 'private SQL details' } } };
    // Act
    const unavailable = isF42SourceUnavailable(error);
    // Assert
    expect(unavailable).toBe(true);
    expect(JSON.stringify(F42_SOURCE_UNAVAILABLE)).not.toContain('private SQL');
  });

  it('recognizes the explicit preflight error and rejects unrelated failures', () => {
    // Arrange
    const error = new F42SourceUnavailableError();
    // Act
    const unavailable = isF42SourceUnavailable(error);
    // Assert
    expect(unavailable).toBe(true);
    expect(isF42SourceUnavailable({ code: '23505' })).toBe(false);
    expect(isF42SourceUnavailable(null)).toBe(false);
    expect(isF42SourceUnavailable('42P01')).toBe(false);
  });

  it('terminates safely on cyclic error causes', () => {
    // Arrange
    const error: { cause?: unknown } = {};
    error.cause = error;
    // Act
    const unavailable = isF42SourceUnavailable(error);
    // Assert
    expect(unavailable).toBe(false);
  });
});

describe('[TC-F40-MIG-LIVE-08] F40 pinned F42 field reader compatibility', () => {
  it('keeps the exact producer registry without importing the exporter', () => {
    // Arrange
    const expectedProducerHash = '6826817b930d4bd88269679bac2b121f1b6f66422839b6e8804a50fe6c8f5ebc';
    // Act
    const keys = QC_FIELD_REGISTRY.map(row => row.key);
    // Assert
    expect(QC_FIELD_REGISTRY_HASH).toBe(expectedProducerHash);
    expect(QC_FIELD_REGISTRY_VERSION).toBe('qc-fields-v1');
    expect(F42_FIELD_EVIDENCE_CONTRACT).toBe('field-evidence-v26');
    expect(keys).toHaveLength(55);
    expect(new Set(keys).size).toBe(55);
    expect(Object.isFrozen(QC_FIELD_REGISTRY)).toBe(true);
    expect(QC_FIELD_REGISTRY.every(Object.isFrozen)).toBe(true);
  });
});
