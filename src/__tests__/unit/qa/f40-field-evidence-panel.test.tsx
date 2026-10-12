import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldEvidencePanel } from '@/app/studio/qa/migration-diff/FieldEvidencePanel';
import type { FieldEvidenceResult } from '@/lib/admin/qa/field-evidence-summary';
import type { SourceCoverage } from '@/lib/admin/qa/f42-source-coverage-reader';

const fieldData: FieldEvidenceResult = {
  summary: {
    generationId: '0f365d52-049c-40a9-9f60-b7a43b084014',
    snapshotId: 'ab365d52-049c-40a9-9f60-b7a43b084014',
    runId: '8ca8922c-d5c7-4e49-879c-622be815549a',
    digest: 'a'.repeat(64), verifiedAt: '2026-10-09T00:00:00.000Z',
    sourceSnapshotAt: '2026-10-08T00:00:00.000Z',
    counts: { match: 1, mismatch: 0, missing: 0, duplicate: 0, unsupported: 0, unverified: 0 },
    outsideScope: 0, outsideComparison: 0, openExceptions: 0,
  },
  rows: [], total: 101, page: 1,
};

const coverageData: SourceCoverage = {
  state: 'complete', reason: null, snapshotId: fieldData.summary!.snapshotId!,
  sourceSnapshotId: null, sourceSnapshotAt: null, manifestSha256: null, sidecarSha256: null,
  sourceInstance: null, registryVersion: 'qc-fields-v1', selectedFiles: [], snapshotRecords: 0,
  records: 0, comparableFields: 0, redactedFields: 0, fieldDispositions: [],
  outsideRegistry: [], unattributed: { records: 0, comparableFields: 0, redactedFields: 0 }, buckets: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('[TC-F40-14-08] Commerce source coverage request lifecycle', () => {
  it('keeps the pinned source inventory while filtering and paging field evidence', async () => {
    // Arrange
    const nextRunId = 'b2a3d1b1-507d-46f9-97e3-aafddfd200d7';
    const nextSnapshotId = 'bc365d52-049c-40a9-9f60-b7a43b084014';
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const nextRun = url.includes(`run_id=${nextRunId}`);
      const data = url.includes('view=source_coverage') ? coverageData : nextRun
        ? { ...fieldData, summary: { ...fieldData.summary!, runId: nextRunId, snapshotId: nextSnapshotId } }
        : fieldData;
      return Response.json({ data });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<FieldEvidencePanel store="42" scope="commerce" refresh={0} selectedRunId={fieldData.summary!.runId} />);
    const sourceRequests = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('view=source_coverage'));
    const fieldRequests = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('view=fields'));
    await waitFor(() => expect(sourceRequests()).toHaveLength(1));
    expect(String(sourceRequests()[0][0])).toContain(`snapshot_id=${fieldData.summary!.snapshotId}`);

    // Act
    fireEvent.click(screen.getByText(/Xem từng trường và lọc kết quả/));
    fireEvent.click(screen.getByRole('button', { name: /Chưa hỗ trợ/ }));
    await waitFor(() => expect(fieldRequests()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(fieldRequests()).toHaveLength(3));

    // Assert
    expect(sourceRequests()).toHaveLength(1);

    // Act: a different run, then explicit refresh, must read the inventory again.
    rerender(<FieldEvidencePanel store="42" scope="commerce" refresh={0} selectedRunId={nextRunId} />);
    await waitFor(() => expect(sourceRequests()).toHaveLength(2));
    expect(String(sourceRequests()[1][0])).toContain(`snapshot_id=${nextSnapshotId}`);
    rerender(<FieldEvidencePanel store="42" scope="commerce" refresh={1} selectedRunId={nextRunId} />);

    // Assert
    await waitFor(() => expect(sourceRequests()).toHaveLength(3));
  });
});
