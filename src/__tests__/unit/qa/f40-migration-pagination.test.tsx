import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MigrationPagination, pageWindow } from '@/app/studio/qa/migration-diff/MigrationPagination';
import { MigrationDiffClient } from '@/app/studio/qa/migration-diff/MigrationDiffClient';
import type { MigrationStore } from '@/lib/admin/qa/website-migration-compare';

const store = (storeId: string, name = `Store ${storeId}`): MigrationStore => ({
  storeId, name, siteId: Number(storeId), canCompare: true,
  migration: 'completed', publish: 'published', auditStatus: 'not-checked',
  errors: 0, warnings: 0, checkedAt: null, url: `/sites/store-${storeId}`, updatedAt: '',
  pageCount: 1, qcStatus: 'unverified', reviewedAt: null,
});

const catalogResponse = ({ stores, total, lifecycleTotal }: { stores: MigrationStore[]; total: number; lifecycleTotal: number }) =>
  new Response(JSON.stringify({
    data: {
      total,
      catalogVersion: 'fixture-v1',
      catalogScope: { kind: 'registered', label: 'fixture catalog', warning: null },
      summary: {
        lifecycle: { total: lifecycleTotal, not_started: 0, running: 0, completed: lifecycleTotal, failed: 0 },
        qc: { passed: 0, warning: 0, failed: 0, unverified: lifecycleTotal },
      },
      stores,
    },
  }), { status: 200 });

const requestedUrls = (request: ReturnType<typeof vi.fn>) => request.mock.calls.map(([url]) => String(url));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('[TC-F40-MIG-LIVE-16] pageWindow', () => {
  it('keeps a window around the current page and marks both gaps', () => {
    // Arrange: a catalog large enough to leave pages hidden on both sides.
    // Act + Assert
    expect(pageWindow(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
  });

  it('anchors at the first and last page without inner gaps', () => {
    // Arrange: the window slides to each edge of the catalog.
    // Act + Assert
    expect(pageWindow(1, 10)).toEqual([1, 2, '…', 10]);
    expect(pageWindow(10, 10)).toEqual([1, '…', 9, 10]);
  });

  it('collapses to contiguous pages for small catalogs', () => {
    // Arrange + Act + Assert
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe('[TC-F40-MIG-LIVE-16] MigrationPagination', () => {
  it('disables previous on the first page and emits the next page once', () => {
    // Arrange
    const onChange = vi.fn();
    render(<MigrationPagination currentPage={1} totalPages={3} onChange={onChange} />);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    // Assert
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('marks the current page and never re-emits it', () => {
    // Arrange
    const onChange = vi.fn();
    render(<MigrationPagination currentPage={2} totalPages={3} onChange={onChange} />);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Trang 2' }));
    // Assert
    expect(screen.getByRole('button', { name: 'Trang 2' })).toHaveAttribute('aria-current', 'page');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('disables every control while the catalog is reloading', () => {
    // Arrange + Act
    render(<MigrationPagination currentPage={2} totalPages={5} disabled onChange={vi.fn()} />);
    // Assert
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});

describe('[TC-F40-MIG-LIVE-16] live catalog pagination', () => {
  it('requests only the visible page and navigates pages on the server', async () => {
    // Arrange: a two-page live catalog (30 stores at the default page size 15).
    const request = vi.fn(async (input: RequestInfo | URL) =>
      catalogResponse({ stores: [store('1'), store('2')], total: 30, lifecycleTotal: 30 }));
    vi.stubGlobal('fetch', request);
    render(<MigrationDiffClient live />);
    // Act: the first render loads page 1, then the user opens page 2.
    await waitFor(() => expect(requestedUrls(request).some(url => url.includes('page=1') && url.includes('limit=15'))).toBe(true));
    const next = await screen.findByRole('button', { name: 'Trang sau' });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
    // Assert: the server is asked for exactly page 2; no client-side page jump.
    await waitFor(() => expect(requestedUrls(request).some(url => url.includes('page=2'))).toBe(true));
    expect(requestedUrls(request).every(url => url.startsWith('/api/admin/qa/website-migrations?'))).toBe(true);
  });

  it('resets to page 1 once when the debounced search commits, not per keystroke', async () => {
    // Arrange: user sits on page 2 of the live catalog.
    const request = vi.fn(async (input: RequestInfo | URL) =>
      catalogResponse({ stores: [store('1')], total: 30, lifecycleTotal: 30 }));
    vi.stubGlobal('fetch', request);
    render(<MigrationDiffClient live />);
    const next = await screen.findByRole('button', { name: 'Trang sau' });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
    await waitFor(() => expect(requestedUrls(request).some(url => url.includes('page=2'))).toBe(true));
    const callsBeforeSearch = request.mock.calls.length;
    // Act: typing must not fire an immediate request carrying the stale query.
    fireEvent.change(screen.getByLabelText('Tìm store'), { target: { value: 'alpha' } });
    expect(request.mock.calls.length).toBe(callsBeforeSearch);
    // Assert: a single request goes out with the committed query and page reset together.
    await waitFor(() => expect(requestedUrls(request).some(url => url.includes('search=alpha'))).toBe(true), { timeout: 2000 });
    expect(request.mock.calls.length).toBe(callsBeforeSearch + 1);
    const committed = requestedUrls(request).at(-1)!;
    expect(committed).toContain('page=1');
    expect(committed).toContain('search=alpha');
  });

  it('[TC-F40-MIG-LIVE-10] summary cards keep whole-catalog counts while search filters the page', async () => {
    // Arrange: the catalog has 30 stores but the search page returns only 1.
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const searched = String(input).includes('search=');
      return catalogResponse({
        stores: searched ? [store('7', 'Alpha Store')] : [store('1'), store('2')],
        total: searched ? 1 : 30,
        lifecycleTotal: 30,
      });
    });
    vi.stubGlobal('fetch', request);
    render(<MigrationDiffClient live />);
    // Act
    fireEvent.change(await screen.findByLabelText('Tìm store'), { target: { value: 'alpha' } });
    await waitFor(() => expect(requestedUrls(request).some(url => url.includes('search=alpha'))).toBe(true), { timeout: 2000 });
    // Assert: the lifecycle summary still describes the whole catalog, not the searched page.
    const totalCard = await screen.findByTestId('migration-metric-all');
    await waitFor(() => expect(within(totalCard).getByText('30')).toBeVisible());
  });
});
