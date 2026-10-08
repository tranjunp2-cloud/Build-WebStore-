import { describe, expect, it } from 'vitest';
import { migrationLifecycleStatus } from '@/lib/admin/qa/migration-lifecycle';

describe('[TC-F40-MIG-LIVE-10] website generation lifecycle', () => {
  it.each([undefined, null, '', 'pending', 'not_started'])('classifies %s as not migrated', status => {
    // Arrange: no completed website generation has been recorded.
    // Act
    const actual = migrationLifecycleStatus(status);
    // Assert
    expect(actual).toBe('not_started');
  });

  it.each(['running', 'completed', 'failed'] as const)('preserves generation state %s', status => {
    // Arrange: use the persisted website generation state.
    // Act
    const actual = migrationLifecycleStatus(status);
    // Assert
    expect(actual).toBe(status);
  });

  it.each(['VERIFIED', 'published', 'passed', 'unknown'])('rejects unrelated or unsupported state %s', status => {
    // Arrange: import, publication and QC are separate state machines.
    // Act
    const classify = () => migrationLifecycleStatus(status);
    // Assert
    expect(classify).toThrow('Unsupported website migration lifecycle status');
  });
});
