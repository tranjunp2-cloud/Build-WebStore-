import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { BlockComparisonPanel } from '@/app/studio/qa/migration-diff/BlockComparisonPanel';
import { MigrationDiffClient } from '@/app/studio/qa/migration-diff/MigrationDiffClient';
import type { Detail } from '@/app/studio/qa/migration-diff/WebsiteMigrationEvidence';
import type { MigrationBlock, MigrationField, MigrationPage } from '@/lib/admin/qa/website-migration-compare';

const field = (key: string, source: string, current: string, status: MigrationField['status'] = 'mismatch'): MigrationField => ({ field: `block[1].${key}`, source, current, status });
const block = (fields: MigrationField[], sourceId = 'banner'): MigrationBlock => ({ sourceId, kind: 'banner', indexes: [0], sourceContent: [], fields, status: fields.some(f => f.status !== 'match') ? 'mismatch' : 'match' });
const page = (blocks: MigrationBlock[]): MigrationPage => ({ sourceId: 'home', title: 'Home', destinationId: 42, url: '/sites/example', fields: [], blocks, audit: null });
function Panel({ blocks }: { blocks: MigrationBlock[] }) {
  const [only, setOnly] = useState(false);
  return <BlockComparisonPanel page={page(blocks)} showOnlyErrors={only} onShowOnlyErrorsChange={setOnly} />;
}
const browserEnvironment = globalThis as typeof globalThis & { jsdom: { reconfigure: (options: { url: string }) => void } };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); browserEnvironment.jsdom.reconfigure({ url: 'http://localhost:3000' }); });

describe('[TC-F40-MIG-LIVE-13] readable block evidence', () => {
  it.each(['null', '1e3', '900719925474099312345', '"quoted title"'])('[TC-F40-MIG-LIVE-15] preserves literal text exactly: %s', (literal) => {
    // Arrange
    const evidence = block([field('headline', literal, literal, 'match')]);
    // Act
    const { container } = render(<Panel blocks={[evidence]} />);
    // Assert
    expect(Array.from(container.querySelectorAll('p')).filter(node => node.textContent === literal)).toHaveLength(2);
  });

  it.each(['\t', '\n', '\r'])('[TC-F40-MIG-LIVE-15] rejects control characters in relative media URLs (%j)', (control) => {
    // Arrange
    const url = `/${control}/127.0.0.1:9000/private`;
    // Act
    render(<Panel blocks={[block([field('image', JSON.stringify({ url }), JSON.stringify({ url }))])]} />);
    // Assert
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it.each(['/a/..//127.0.0.1:9000/private', '/a/%2e%2e//127.0.0.1:9000/private'])('[TC-F40-MIG-LIVE-15] rejects paths normalizing to a protocol-relative URL (%s)', (url) => {
    // Arrange
    const evidence = block([field('image', JSON.stringify({ url }), JSON.stringify({ url }))]);
    // Act
    render(<Panel blocks={[evidence]} />);
    // Assert
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it.each(['localhost.', 'localhost%2e', 'x.localhost.', 'x.local.'])('[TC-F40-MIG-LIVE-15] rejects local DNS names with trailing dots (%s)', (host) => {
    // Arrange
    const url = `http://${host}:9000/private`;
    // Act
    render(<Panel blocks={[block([field('image', JSON.stringify({ url }), JSON.stringify({ url }))])]} />);
    // Assert
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('[TC-F40-MIG-LIVE-15] distinguishes absent slide position from present empty slide', () => {
    // Arrange
    const evidence = block([field('slides', '["First",""]', '["First"]')]);
    // Act
    render(<Panel blocks={[evidence]} />);
    // Assert
    const second = screen.getByRole('heading', { name: 'Mục 2' }).parentElement!;
    expect(within(second).getByText('Không có nội dung')).toBeVisible();
    expect(within(second).getByText('Chưa có dữ liệu')).toBeVisible();
  });

  it('[TC-F40-MIG-LIVE-15] highlights only changed slide nested text and link, ignoring metadata IDs', () => {
    // Arrange
    const source = [{ id: 'old-id', headline: 'Same first' }, { headline: 'Old title', ctaButtons: [{ label: 'Buy', url: '/old' }] }, { headline: 'Same third' }];
    const current = [{ id: 'new-id', headline: 'Same first' }, { headline: 'New title', ctaButtons: [{ label: 'Buy', url: '/new' }] }, { headline: 'Same third' }];
    // Act
    render(<Panel blocks={[block([field('slides', JSON.stringify(source), JSON.stringify(current))])]} />);
    // Assert
    const first = screen.getByRole('heading', { name: 'Mục 1' }).parentElement!;
    const second = screen.getByRole('heading', { name: 'Mục 2' }).parentElement!;
    const third = screen.getByRole('heading', { name: 'Mục 3' }).parentElement!;
    expect(first.querySelector('mark')).toBeNull();
    expect(third.querySelector('mark')).toBeNull();
    expect(first.querySelector('[class*="border-rose-"]')).toBeNull();
    expect(third.querySelector('[class*="border-rose-"]')).toBeNull();
    expect(Array.from(second.querySelectorAll('mark'), node => node.textContent)).toEqual(expect.arrayContaining(['Old', 'New', 'old', 'new']));
  });
  it('[TC-F40-MIG-LIVE-14] keeps page caveats optional and opens filtered block comparison through the header button', async () => {
    // Arrange — exercise real client state and real block panel, mock network boundary only.
    const detail: Detail = {
      storeId: '42', name: 'Test store', siteId: 42, review: null, inputHash: '', attemptId: null,
      committedAt: null, checkedAt: null, sourceUrl: 'https://example.com/', url: '/sites/example',
      settings: [], warnings: [], evidence: '', migration: 'completed', publish: 'published', auditStatus: 'not-checked',
      pages: [page([block([field('headline', 'Same', 'Same', 'match')], 'one'), block([field('headline', 'Old', 'New')], 'two')]), { ...page([]), sourceId: 'products', title: 'Products', url: '/sites/example/products', destinationId: 43 }],
    };
    const request = vi.fn(async (input: string) => new Response(JSON.stringify({ data: input.includes('?store=') ? detail : {
      total: 1, catalogVersion: 'fixture-v1', summary: { lifecycle: { total: 1, not_started: 0, running: 0, completed: 1, failed: 0 }, qc: { passed: 0, warning: 0, failed: 0, unverified: 1 } }, stores: [{ storeId: '42', name: 'Test store', siteId: 42, canCompare: true, migration: 'completed', publish: 'published', auditStatus: 'not-checked', errors: 0, warnings: 0, checkedAt: null, url: '/sites/example', updatedAt: '', pageCount: 1, qcStatus: 'unverified', reviewedAt: null }],
    } }), { status: 200 }));
    vi.stubGlobal('fetch', request);
    render(<MigrationDiffClient live />);
    fireEvent.click(await screen.findByTestId('migration-store-compare-42'));
    await waitFor(() => expect(screen.getByTitle('PW1 Desktop Storefront')).toBeVisible());
    expect(screen.queryByText(/Báo cáo tự động từ evidence F42 đã lưu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PW1 được nhúng từ URL snapshot F42/)).not.toBeInTheDocument();
    // Non-home pages retain real URLs but keep the homepage caveat in an opt-in disclosure.
    fireEvent.click(screen.getByTestId('migration-page-tab-products'));
    expect(screen.getByTitle('PW2 Next.js Desktop Storefront')).toHaveAttribute('src', '/sites/example/products');
    expect(screen.getByTitle('PW1 Desktop Storefront')).toHaveAttribute('src', 'https://example.com/');
    const info = screen.getByText('Thông tin đối chiếu', { exact: true });
    const disclosure = info.closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    expect(within(disclosure!).getByText(/PW1 đang hiển thị trang chủ/)).not.toBeVisible();
    fireEvent.click(info);
    expect(disclosure).toHaveAttribute('open');
    expect(within(disclosure!).getByText(/PW1 đang hiển thị trang chủ/)).toBeVisible();
    fireEvent.click(info);
    fireEvent.click(screen.getByTestId('migration-page-tab-home'));
    expect(screen.getByTitle('PW2 Next.js Desktop Storefront')).toHaveAttribute('src', '/sites/example');
    const qc = screen.getByRole('button', { name: 'Đánh giá QC', exact: true });
    fireEvent.click(qc);
    expect(screen.getByRole('menu', { name: 'Đánh giá QC' })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Đánh giá QC' })).not.toBeInTheDocument();
    // Act
    const attention = screen.getByRole('button', { name: 'Lỗi / cần xem', exact: true });
    fireEvent.click(attention);
    // Assert
    expect(screen.getByRole('region', { name: 'So sánh khối dễ đọc' })).toBeVisible();
    expect(attention).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { name: 'Khối 1 · Banner' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Khối 2 · Banner' })).toBeVisible();
    fireEvent.click(attention);
    expect(attention).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: 'Khối 1 · Banner' })).toBeVisible();
    expect(request.mock.calls.every(([url]) => url.startsWith('/api/admin/qa/website-migrations?'))).toBe(true);
  });
  it('labels expected data F42, explains extra title, and collapses raw evidence', () => {
    // Arrange
    const evidence = block([field('headline', '', 'Welcome')]);
    evidence.sourceContent = [{ field: 'headline', value: 'Original PW1 content' }];
    // Act
    const { container } = render(<Panel blocks={[evidence]} />);
    // Assert
    expect(screen.getByText('Kỳ vọng F42')).toBeVisible();
    expect(screen.queryByText('PW1 SOURCE')).not.toBeInTheDocument();
    expect(screen.getByText('PW2 có thêm nội dung so với dữ liệu đối chiếu.')).toBeVisible();
    expect(screen.getByText('Welcome')).toBeVisible();
    const raw = container.querySelector('pre');
    expect(container.querySelectorAll('details')).toHaveLength(1);
    expect(raw?.closest('details')).not.toHaveAttribute('open');
    expect(raw).toHaveTextContent('Original PW1 content');
    expect(raw).not.toBeVisible();
    expect(screen.queryByText('Nội dung nguồn PW1 do F42 lưu', { exact: true })).not.toBeInTheDocument();
  });

  it('preserves original block numbering when filtering and displays matching values inline', () => {
    // Arrange
    render(<Panel blocks={[block([field('headline', 'Same', 'Same', 'match')], 'one'), block([field('headline', 'Old', 'New')], 'two')]} />);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cần kiểm tra', exact: true }));
    // Assert
    expect(screen.queryByRole('heading', { name: 'Khối 1 · Banner' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Khối 2 · Banner' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cần kiểm tra', exact: true })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả', exact: true }));
    expect(screen.getAllByText('Same')).toHaveLength(2);
    for (const value of screen.getAllByText('Same')) expect(value).toBeVisible();
    expect(screen.queryByText('Xem 1 mục khớp dữ liệu')).not.toBeInTheDocument();
  });

  it('keeps matching and changed fields in their original order', () => {
    // Arrange
    const evidence = block([field('blockType', 'hero', 'hero', 'match'), field('headline', 'Old', 'New'), field('ctaButtons', '[]', '[]', 'match')]);
    // Act
    const { container } = render(<Panel blocks={[evidence]} />);
    // Assert
    expect(Array.from(container.querySelectorAll('h5'), node => node.textContent)).toEqual(['Loại khối', 'Tiêu đề', 'Nút bấm']);
    expect(container.querySelectorAll('details')).toHaveLength(1);
  });

  it('distinguishes missing evidence from intentionally empty content', () => {
    // Arrange
    const evidence = block([field('headline', '(missing)', '', 'unverified')]);
    // Act
    render(<Panel blocks={[evidence]} />);
    // Assert
    expect(screen.getByText('Chưa có dữ liệu')).toBeVisible();
    expect(screen.getByText('Không có nội dung')).toBeVisible();
    expect(screen.queryByText('(missing)', { exact: true })).not.toBeInTheDocument();
  });

  it('pairs ordered list entries and shows missing destination items', () => {
    // Arrange
    const evidence = block([field('slides', JSON.stringify([{ headline: 'First' }, { headline: 'Second' }]), JSON.stringify([{ headline: 'Changed' }]))]);
    // Act
    render(<Panel blocks={[evidence]} />);
    // Assert
    const first = screen.getByRole('heading', { name: 'Mục 1' }).parentElement!;
    const second = screen.getByRole('heading', { name: 'Mục 2' }).parentElement!;
    expect(within(first).getByText('First')).toBeVisible();
    expect(within(first).getByText('Changed')).toBeVisible();
    expect(within(second).getByText('Second')).toBeVisible();
    expect(within(second).getByText(/Không có nội dung|Chưa có dữ liệu/)).toBeVisible();
  });

  it('does not certify URL-only image differences and reports image load failure', () => {
    // Arrange
    const evidence = block([field('image', JSON.stringify({ url: 'https://example.com/a.jpg', alt: 'Source' }), JSON.stringify({ url: 'https://example.com/b.jpg', alt: 'Destination' }))]);
    render(<Panel blocks={[evidence]} />);
    const image = screen.getByRole('img', { name: 'Source' });
    // Act
    fireEvent.error(image);
    // Assert
    expect(screen.getByText('Không tải được ảnh')).toBeVisible();
    expect(screen.getByText(/Khác URL chưa đủ kết luận sai ảnh/)).toBeVisible();
    expect(screen.queryByText('Dữ liệu khác', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Destination' })).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('places enlarged images above the comparison overlay', () => {
    // Arrange
    const evidence = block([field('image', JSON.stringify({ url: 'https://example.com/a.jpg', alt: 'Source' }), JSON.stringify({ url: 'https://example.com/b.jpg', alt: 'Destination' }))]);
    render(<Panel blocks={[evidence]} />);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Phóng to ảnh Kỳ vọng F42' }));
    // Assert — class contract only; browser stacking requires a real browser check.
    expect(screen.getByRole('dialog', { name: 'Ảnh · Kỳ vọng F42' })).toHaveClass('z-[1000003]');
    expect(document.querySelector('.z-\\[1000002\\]')).toBeInTheDocument();
  });

  it.each(['javascript:alert(1)', 'https://user:password@example.com/a.jpg', 'http://127.0.0.1/a.jpg', 'http://localhost:9000/a.jpg'])('never emits unsafe image requests: %s', (url) => {
    // Arrange
    const evidence = block([field('image', JSON.stringify({ url }), JSON.stringify({ url }))]);
    // Act
    render(<Panel blocks={[evidence]} />);
    // Assert
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Phóng to ảnh/ })).not.toBeInTheDocument();
  });

  it('allows the known local media bucket only from the same local app hostname', () => {
    // Arrange
    browserEnvironment.jsdom.reconfigure({ url: 'http://localhost:3000' });
    const url = 'http://localhost:9000/primeweb-media/banner.jpg';
    // Act
    render(<Panel blocks={[block([field('image', JSON.stringify({ url }), JSON.stringify({ url }))])]} />);
    // Assert
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', url);
  });

  it.each([
    ['http://localhost:3000', 'http://localhost:9001/primeweb-media/banner.jpg'],
    ['http://localhost:3000', 'http://localhost:9000/primeweb-media/banner.jpg?token=example'],
    ['http://localhost:3000', 'http://localhost:9000/other/banner.jpg'],
    ['http://localhost:3000', 'http://127.0.0.1:9000/primeweb-media/banner.jpg'],
    ['https://staging.example.com', 'http://localhost:9000/primeweb-media/banner.jpg'],
  ])('rejects local media outside the allowed app/bucket boundary (%s, %s)', (app, url) => {
    // Arrange
    browserEnvironment.jsdom.reconfigure({ url: app });
    // Act
    render(<Panel blocks={[block([field('image', JSON.stringify({ url }), JSON.stringify({ url }))])]} />);
    // Assert
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
