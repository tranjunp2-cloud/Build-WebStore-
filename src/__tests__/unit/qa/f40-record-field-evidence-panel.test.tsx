import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordFieldEvidencePanel } from '@/app/studio/qa/migration-diff/RecordFieldEvidencePanel';

const props = {
  storeId: '205', runId: '3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db', reference: 'a'.repeat(32),
  version: { generationId: '46dcd066-6319-484c-9235-6c23a7acfb8c', digest: 'd'.repeat(64) },
};

afterEach(() => vi.unstubAllGlobals());

describe('[TC-F40-14-07] Record field evidence panel request lifecycle', () => {
  it('requests the record once, bound to its Store, run, reference and version', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { state: 'complete', reason: null, runId: props.runId, generationId: props.version.generationId, snapshotId: null, sourceSnapshotAt: null, verifiedAt: null, rows: [], total: 0, page: 1, counts: { match: 0, mismatch: 0, missing: 0, duplicate: 0, unsupported: 0, unverified: 0 } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    // Act
    render(<RecordFieldEvidencePanel {...props} />);

    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]), 'http://localhost');
    expect(url.searchParams.get('record_ref')).toBe(props.reference);
    expect(url.searchParams.get('store_id')).toBe('205');
    expect(url.searchParams.get('run_id')).toBe(props.runId);
    expect(url.searchParams.get('generation_id')).toBe(props.version.generationId);
    expect(url.searchParams.get('generation_digest')).toBe(props.version.digest);
  });

  it.each([404, 409])('tells the user to reload the run when the API answers %i', async (status) => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));

    // Act
    render(<RecordFieldEvidencePanel {...props} />);

    // Assert
    expect(await screen.findByText(/Đóng chi tiết và tải lại run/)).toBeTruthy();
  });

  it('shows a retry message for other failures', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));

    // Act
    render(<RecordFieldEvidencePanel {...props} />);

    // Assert
    expect(await screen.findByText(/Không tải được bằng chứng của bản ghi/)).toBeTruthy();
  });
});
