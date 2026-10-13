import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { SignJWT } from "jose";
import { classifyMigrationReport } from "@/lib/admin/qa/migration-report-status";
import { migrationLifecycleStatus, MIGRATION_LIFECYCLE_LABELS } from "@/lib/admin/qa/migration-lifecycle";
import { fieldEvidenceRates } from "@/lib/admin/qa/field-evidence-summary";
import type { MigrationStore } from "@/lib/admin/qa/website-migration-compare";

test.use({ trace: "off", screenshot: "off", video: "off" });

test('[TC-F40-MIG-LIVE-12] missing F42 source reports unavailable without false zero totals', async ({ page, request, baseURL }) => {
  test.setTimeout(120000);
  // Dedicated synthetic local fixture only; no production/customer DB writes.
  const fixture = process.env.DATABASE_URI;
  test.skip(!fixture || !process.env.PAYLOAD_SECRET || !baseURL, 'Requires isolated missing-F42 fixture');
  test.skip(!['localhost', '127.0.0.1'].includes(new URL(baseURL!).hostname)
    || !new URL(fixture!).pathname.startsWith('/f40_ui_unavailable_'), 'Requires dedicated local missing-F42 DB');
  const db = new Client({ connectionString: fixture });
  await db.connect();
  let userId: number;
  try {
    const readiness = (await db.query("SELECT to_regclass('public.pw1_migration_stores') AS stores, to_regclass('public.migration_evidence_generations') AS evidence")).rows[0];
    expect(readiness.stores).toBeNull();
    expect(readiness.evidence).toBeNull();
    const result = await db.query<{ id: number }>("SELECT id FROM users WHERE email=$1", ['qc-f40-fixture@example.invalid']);
    expect(result.rows).toHaveLength(1);
    userId = result.rows[0].id;
  } finally { await db.end(); }
  // Arrange: real server authentication, never mock the missing schema response.
  expect([401, 403]).toContain((await request.get('/api/admin/qa/website-migrations')).status());
  expect([401, 403]).toContain((await request.get('/api/qa/migration-reconciliation?view=source_coverage&store_id=3')).status());
  const token = await new SignJWT({ id: userId!, collection: 'users', mfa_verified: true, roles: ['super-admin'] })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.PAYLOAD_SECRET));
  await page.context().addCookies([{ name: 'payload-token', value: token, url: baseURL! }]);
  for (const path of ['/api/admin/qa/website-migrations', '/api/admin/qa/website-migrations?store=3', '/api/qa/migration-reconciliation?view=fields&store_id=3', '/api/qa/migration-reconciliation?view=source_coverage&store_id=3', `/api/admin/qa/website-migrations/images?store=3&version=${'0'.repeat(32)}`]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(503);
    expect((await response.json()).code).toBe('F42_SOURCE_UNAVAILABLE');
  }
  // Act / Assert: unavailable is not an empty migration report.
  await page.goto('/studio/qa/migration-diff');
  const sourceAlert = page.getByTestId('website-migration-live').getByRole('alert');
  await expect(sourceAlert).toContainText('Schema hoặc phạm vi nguồn F42 chưa xác định');
  await expect(page.getByTestId('migration-metric-all')).toHaveCount(0);
  await expect(page.getByTestId('migration-pagination')).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới evidence', exact: true }).click();
  await expect(sourceAlert).toContainText('Chưa thể xác định số website');
  await expect(page.getByTestId('migration-metric-all')).toHaveCount(0);
});

async function checkWebsiteMigration({
  page,
  request,
  baseURL,
}: { page: Page; request: APIRequestContext; baseURL: string | undefined }, qcOnly = false, blocksOnly = false, lifecycleOnly = false) {
  test.setTimeout(120000);
  expect([401, 403]).toContain(
    (
      await request.post("/api/admin/qa/website-migrations/images", {
        data: {},
      })
    ).status(),
  );
  const denied = await request.get("/api/admin/qa/website-migrations");
  expect([401, 403]).toContain(denied.status());
  expect([401, 403]).toContain((await request.post('/api/admin/qa/website-migrations', {
    data: { mode: 'quick', store: '1', version: '0'.repeat(32), verdict: 'passed' },
  })).status());
  expect([401, 403]).toContain((await request.get('/api/qa/migration-reconciliation?view=fields&store_id=575')).status());
  expect([401, 403]).toContain((await request.get('/api/qa/migration-reconciliation?view=source_coverage&store_id=575')).status());
  test.skip(
    !process.env.PAYLOAD_SECRET || !process.env.DATABASE_URI,
    "Requires the local migration fixture DB and Payload secret",
  );
  test.skip(
    !baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname),
    "Local real-data test only",
  );
  const client = new Client({ connectionString: process.env.DATABASE_URI });
  await client.connect();
  let admin: { id: number } | undefined;
  let owner: { id: number } | undefined;
  try {
    admin = (
      await client.query<{ id: number }>(
        "SELECT u.id FROM users u JOIN users_roles r ON r.parent_id=u.id WHERE r.value='super-admin' LIMIT 1",
      )
    ).rows[0];
    owner = (
      await client.query<{ id: number }>(
        "SELECT u.id FROM users u WHERE NOT EXISTS(SELECT 1 FROM users_roles r WHERE r.parent_id=u.id AND r.value='super-admin') LIMIT 1",
      )
    ).rows[0];
  } finally {
    await client.end();
  }
  expect(admin).toBeTruthy();
  const token = await new SignJWT({
    id: admin!.id,
    collection: "users",
    mfa_verified: true,
    roles: ["super-admin"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.PAYLOAD_SECRET));
  await page
    .context()
    .addCookies([{ name: "payload-token", value: token, url: baseURL! }]);
  if (owner) {
    const ownerToken = await new SignJWT({
      id: owner.id,
      collection: "users",
      mfa_verified: true,
      roles: ["tenant-owner"],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.PAYLOAD_SECRET));
    const ownerContext = await page.context().browser()!.newContext();
    try {
      await ownerContext.addCookies([
        { name: "payload-token", value: ownerToken, url: baseURL! },
      ]);
      expect(
        (
          await ownerContext.request.get(
            baseURL! + "/api/admin/qa/website-migrations",
          )
        ).status(),
      ).toBe(403);
      expect(
        (
          await ownerContext.request.post(
            baseURL! + "/api/admin/qa/website-migrations",
            { data: {} },
          )
        ).status(),
      ).toBe(403);
    } finally {
      await ownerContext.close();
    }
  }
  await page.goto("/studio/qa/migration-diff");
  await expect(page.getByTestId("website-migration-live")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Website Migration", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cấu hình nguồn dữ liệu", exact: true }).click();
  const databaseDialog = page.getByRole("dialog", { name: "Nguồn dữ liệu F42 và kết nối PW1" });
  await expect(databaseDialog).toBeVisible();
  await expect(databaseDialog).toContainText("Nguồn đang dùng: migration F42");
  await expect(databaseDialog).toContainText("Chưa kiểm tra kết nối MySQL PW1");
  await expect(databaseDialog.getByLabel("Host PW1", { exact: true })).toBeVisible();
  await expect(databaseDialog.getByLabel("Password PW1", { exact: true })).toHaveAttribute("type", "password");
  await databaseDialog.getByRole("button", { name: "Nhập dạng URL string", exact: true }).click();
  await expect(databaseDialog.getByLabel("URL kết nối MySQL PW1")).toHaveAttribute("type", "password");
  await databaseDialog.getByLabel("URL kết nối MySQL PW1").fill("https://invalid.example/");
  await databaseDialog.getByRole("button", { name: /Kiểm Tra Kết Nối MySQL/ }).click();
  await expect(databaseDialog.getByRole("alert")).toBeVisible();
  await databaseDialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(databaseDialog).toHaveCount(0);
  const catalog = await page.request.get(
    "/api/admin/qa/website-migrations?limit=1",
  );
  expect(catalog.status()).toBe(200);
  const data = (await catalog.json()).data;
  test.skip(!data.stores.length, "No migrated stores in fixture DB");
  // TC-F40-MIG-LIVE-10: real catalog → report cards → filtered rows.
  // Arrange: use the source policy, never reproduce the classifier in tests.
  const inventory: MigrationStore[] = [];
  for (let current = 1; inventory.length < data.total; current += 1) {
    const response = await page.request.get(`/api/admin/qa/website-migrations?limit=100&page=${current}`);
    expect(response.status()).toBe(200);
    const batch = (await response.json()).data;
    expect(batch.stores.length).toBeGreaterThan(0);
    inventory.push(...batch.stores);
  }
  await expect(page.getByRole('columnheader', { name: 'QC thủ công', exact: true })).toBeVisible();
  expect(new Set(inventory.map(item => item.storeId)).size).toBe(data.total);
  await expect(page.getByTestId('migration-metric-all').getByText(data.total.toLocaleString(), { exact: true })).toBeVisible();
  for (const status of ['not_started', 'running', 'completed', 'failed'] as const) {
    const expected = inventory.filter(item => migrationLifecycleStatus(item.migration) === status);
    // Act
    const card = page.getByTestId(`migration-metric-${status}`);
    await card.click();
    // Assert: selection remains visible and table agrees with the same policy.
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toContainText(MIGRATION_LIFECYCLE_LABELS[status]);
    await expect(card.getByText(expected.length.toLocaleString(), { exact: true })).toBeVisible();
    await expect(page.getByTestId('migration-pagination')).toContainText('Trang 1 /');
    const visibleRows = page.locator('[data-testid^="migration-store-row-"]');
    await expect(visibleRows).toHaveCount(Math.min(15, expected.length));
    for (const item of expected.slice(0, 15)) {
      const row = page.getByTestId(`migration-store-row-${item.storeId}`);
      await expect(row).toBeVisible();
      await expect(row).toContainText(MIGRATION_LIFECYCLE_LABELS[status]);
      if (item.siteId === null) {
        await expect(row).toContainText('Chưa có website PW2');
        await expect(row.locator('a')).toHaveCount(0);
        await expect(page.getByTestId(`migration-store-compare-${item.storeId}`)).toBeDisabled();
      }
      await expect(row.getByRole('cell').nth(4)).toHaveText(/^\s*\d+ Trang\s*$/);
      const rate = row.getByTestId('migration-match-rate');
      const percentage = item.websiteComparison?.percentage ?? null;
      if (percentage === null) {
        await expect(rate).toContainText('—');
        await expect(rate.getByRole('progressbar')).toHaveCount(0);
        await expect(rate).toContainText('Chưa có dữ liệu đối soát website');
      } else {
        await expect(rate).toContainText(`${percentage}%`);
        await expect(rate.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(percentage));
        const color = percentage === 100 ? 'bg-emerald-400' : percentage >= 85 ? 'bg-amber-400' : 'bg-rose-500';
        await expect(rate.getByRole('progressbar').locator('div')).toHaveClass(new RegExp(color));
      }

    }
    // Search and pagination must retain the selected lifecycle.
    await page.getByRole('textbox', { name: 'Tìm store' }).fill('no-such-store-f40-lifecycle');
    await expect(visibleRows).toHaveCount(0);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('textbox', { name: 'Tìm store' }).fill('');
    await expect(visibleRows).toHaveCount(Math.min(15, expected.length));
    if (expected.length > 15) {
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(visibleRows).toHaveCount(Math.min(15, expected.length - 15));
      for (const item of expected.slice(15, 30)) {
        await expect(page.getByTestId(`migration-store-row-${item.storeId}`)).toBeVisible();
      }
      await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
    }
  }
  await page.getByTestId('migration-metric-all').click();
  await expect(page.getByTestId('migration-metric-all')).toHaveAttribute('aria-pressed', 'true');
  if (lifecycleOnly) {
    // TC-F40-MIG-LIVE-16: require the fixture branch to be exercised, not silently skipped.
    const sourceOnly = inventory.find(item => item.siteId === null && migrationLifecycleStatus(item.migration) === 'not_started');
    expect(sourceOnly, 'Lifecycle fixture must include a registered source without a PW2 site').toBeDefined();
    await page.getByTestId('migration-metric-not_started').click();
    await page.getByRole('textbox', { name: 'Tìm store' }).fill(sourceOnly!.storeId);
    const row = page.getByTestId(`migration-store-row-${sourceOnly!.storeId}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Chưa có website PW2');
    await expect(row).toContainText('Chưa thể QC');
    await expect(row.locator('a')).toHaveCount(0);
    await expect(page.getByTestId(`migration-store-compare-${sourceOnly!.storeId}`)).toBeDisabled();
    return;
  }
  const comparable = inventory.find(item => item.canCompare && item.siteId !== null);
  expect(comparable, 'Fixture needs a mapped website for comparison').toBeDefined();
  const store = comparable!.storeId;
  await page.getByRole('textbox', { name: 'Tìm store' }).fill(store);
  await page.getByTestId(`migration-store-compare-${store}`).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const detail = await page.request.get(
    "/api/admin/qa/website-migrations?store=" + store,
  );
  expect(detail.status()).toBe(200);
  const snapshot = (await detail.json()).data;
  expect(snapshot.storeId).toBe(store);
  expect(snapshot.pages.length).toBeGreaterThan(0);
  // TC-F40-MIG-LIVE-13: real evidence and browser UI only. Return before
  // QC/image writes; do not intercept requests or substitute fixture responses.
  if (blocksOnly) {
    await expect(page.getByText(/Báo cáo tự động từ evidence F42 đã lưu/)).toHaveCount(0);
    await expect(page.getByText(/PW1 được nhúng từ URL snapshot F42/)).toHaveCount(0);
    const attention = page.getByRole('button', { name: 'Lỗi / cần xem', exact: true });
    await attention.click();
    await expect(attention).toHaveAttribute('aria-pressed', 'true');
    const panel = page.getByRole('region', { name: 'So sánh khối dễ đọc' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Đối chiếu dữ liệu kỳ vọng F42 với PW2');
    await panel.getByRole('button', { name: 'Tất cả', exact: true }).click();
    await expect(panel.getByTestId('migration-block-card')).toHaveCount(snapshot.pages[0].blocks.length);
    for (const [index] of snapshot.pages[0].blocks.entries()) {
      const card = panel.getByTestId('migration-block-card').nth(index);
      await expect(card).toHaveAttribute('data-block-number', String(index + 1));
      await expect(card.locator('details')).toHaveCount(1);
      await expect(card.locator('pre')).not.toBeVisible();
      await card.getByText('Chi tiết kỹ thuật', { exact: true }).click();
      await expect(card.locator('pre')).toBeVisible();
      await card.getByText('Chi tiết kỹ thuật', { exact: true }).click();
    }
    await panel.getByRole('button', { name: 'Cần kiểm tra', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Cần kiểm tra', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Xem Web Thật (Live Iframe)', exact: true }).click();
    await expect(panel).toHaveCount(0);
    return;
  }
  // TC-F40-MIG-LIVE-11: compare the real API and visible labels with mapped
  // PW2 CMS records. Navigation-menu labels are not inferred from page order.
  const pagesClient = new Client({ connectionString: process.env.DATABASE_URI });
  await pagesClient.connect();
  try {
    const ids = snapshot.pages.map((item: { destinationId: number | null }) => item.destinationId).filter((id: number | null) => id !== null);
    const actual = await pagesClient.query<{ id: number; title: string | null; slug: string | null; menu_label: string | null }>(
      `SELECT p.id,p.title,p.slug,
        (SELECT CASE WHEN count(DISTINCT btrim(link->>'label'))=1 THEN min(btrim(link->>'label')) END
         FROM jsonb_array_elements(COALESCE(s.header_block->'links','[]'::jsonb)) link
         WHERE btrim(COALESCE(link->>'label',''))<>'' AND
           (link->>'url'=CASE WHEN p.is_homepage THEN '/' ELSE '/'||p.slug END
            OR link->>'url'='/sites/'||t.slug||CASE WHEN p.is_homepage THEN '' ELSE '/'||p.slug END)) AS menu_label
       FROM pages p JOIN sites s ON s.id=p.site_id
       JOIN pw1_migration_stores m ON m.site_id=s.id JOIN tenants t ON t.id=m.tenant_id
       WHERE p.id=ANY($1::int[])`, [ids],
    );
    for (const item of snapshot.pages) {
      const destination = actual.rows.find(record => record.id === item.destinationId);
      const expectedTitle = destination ? destination.menu_label || destination.title || destination.slug || 'Trang PW2' : 'Chưa có trang PW2';
      expect(item.title).toBe(expectedTitle);
      await expect(page.getByTestId(`migration-page-tab-${item.sourceId}`)).toContainText(expectedTitle);
    }
  } finally {
    await pagesClient.end();
  }
  // TC-F40-MIG-LIVE-09: dropdown lives inside comparison, not another review
  // page. No successful verdict save is performed against real fixture data.
  const reviewTrigger = page.getByRole('button', { name: 'Đánh giá QC', exact: true });
  await reviewTrigger.click();
  const reviewMenu = page.getByRole('menu', { name: 'Đánh giá QC', exact: true });
  await expect(reviewMenu).toBeVisible();
  await expect(reviewMenu.getByRole('menuitem', { name: 'Pass', exact: true })).toBeVisible();
  await expect(reviewMenu.getByRole('menuitem', { name: 'Failed', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Đánh giá QC website', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem Web Thật (Live Iframe)', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(reviewMenu).toHaveCount(0);
  await expect(reviewTrigger).toBeFocused();
  await expect(page.getByRole('button', { name: 'Xem Web Thật (Live Iframe)', exact: true })).toBeVisible();
  // Disabling an item during save can leave focus on the body. Escape must
  // still dismiss only the menu, not the underlying comparison.
  await reviewTrigger.click();
  await expect(reviewMenu).toBeVisible();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press('Escape');
  await expect(reviewMenu).toHaveCount(0);
  await expect(reviewTrigger).toBeFocused();
  await expect(page.getByRole('dialog')).toBeVisible();
  const quickReview = { mode: 'quick', store, version: snapshot.review?.version ?? '0'.repeat(32), verdict: 'passed' };
  // Field evidence is latest-only: an explicit run must be rejected, not
  // silently ignored while returning another run's comparison.
  expect((await page.request.get(
    `/api/qa/migration-reconciliation?view=fields&store_id=${store}&run_id=11111111-1111-4111-8111-111111111111`,
  )).status()).toBe(400);
  expect((await page.request.post('/api/admin/qa/website-migrations', {
    data: { ...quickReview, verdict: 'warning' },
  })).status()).toBe(400);
  expect((await page.request.post('/api/admin/qa/website-migrations', {
    data: { ...quickReview, checks: { content: true } },
  })).status()).toBe(400);
  expect((await page.request.post('/api/admin/qa/website-migrations', {
    data: { store, version: quickReview.version, verdict: 'passed', note: 'Legacy validation only',
      checks: { content: false, media: false, mapping: false, visual: false, audit: false } },
  })).status()).toBe(400);
  expect((await page.request.post('/api/admin/qa/website-migrations', {
    data: { ...quickReview, version: '0'.repeat(32) },
  })).status()).toBe(409);
  if (qcOnly) return;
  // TC-F40-MIG-LIVE-08: real authenticated browser reads the field-evidence panel.
  await page.getByRole('button', { name: 'Đối soát Commerce', exact: true }).click();
  const fieldPanel = page.getByRole('region', { name: 'Đối soát từng trường F42' });
  await expect(page.getByTestId('migration-reconciliation-scroll')).toHaveCSS('overflow-y', 'auto');
  await expect(page.getByTestId('migration-reconciliation-scroll')).not.toContainText('Đang đọc bằng chứng đối soát…');
  const fieldResponse = await page.request.get(`/api/qa/migration-reconciliation?view=fields&store_id=${store}&scope=commerce`);
  expect(fieldResponse.status()).toBe(200);
  const fieldData = (await fieldResponse.json()).data;
  // TC-F40-MIG-LIVE-08: the browser reads the real pre-filter source artifact.
  // An older fixture may lack the F42 sidecar schema, which must fail closed.
  const pinnedSnapshot = fieldData.summary?.snapshotId ? `&snapshot_id=${encodeURIComponent(fieldData.summary.snapshotId)}` : '';
  const sourceResponse = await page.request.get(`/api/qa/migration-reconciliation?view=source_coverage&store_id=${store}&scope=commerce${pinnedSnapshot}`);
  if (sourceResponse.status() === 503) {
    expect((await sourceResponse.json()).code).toBe('F42_SOURCE_UNAVAILABLE');
  } else {
    expect(sourceResponse.status()).toBe(200);
    const source = (await sourceResponse.json()).data;
    expect(['complete', 'unavailable']).toContain(source.state);
    if (source.state === 'complete') {
      expect(source.snapshotId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(source.manifestSha256).toMatch(/^[0-9a-f]{64}$/i);
      expect(source.sidecarSha256).toMatch(/^[0-9a-f]{64}$/i);
      if (fieldData.summary?.snapshotId) expect(source.snapshotId).toBe(fieldData.summary.snapshotId);
      expect(source.records).toBeGreaterThan(0);
      expect(source.buckets.reduce((sum: number, bucket: { records: number }) => sum + bucket.records, 0)).toBe(source.records);
    } else {
      expect(source.reason).toEqual(expect.any(String));
      expect(source.records).toBe(0);
    }
  }
  if (!fieldData.summary) await expect(fieldPanel).toBeVisible();
  if (await fieldPanel.count()) {
    const sourceCard = page.getByTestId('commerce-source-coverage');
    const fidelityCard = page.getByTestId('commerce-import-fidelity');
    await expect(sourceCard).toContainText('Dữ liệu gốc trong PW1');
    await expect(fidelityCard).toContainText('Các trường đã được đối chiếu');
    if (sourceResponse.status() === 503) {
      await expect(sourceCard).toContainText('Không đọc được kiểm kê nguồn PW1');
    } else if ((await sourceResponse.json()).data.state === 'unavailable') {
      await expect(sourceCard).toContainText('Chưa đủ bằng chứng');
    } else {
      await expect(sourceCard).toContainText(/bản ghi ở các bảng Commerce|Chưa đủ bằng chứng/);
      await fieldPanel.getByText('Xem kiểm kê nguồn và thông tin kỹ thuật').click();
      await expect(fieldPanel.getByText(/Sidecar SHA-256/)).toBeVisible();
    }
    if (fieldData.summary) {
      if (!await fieldPanel.locator('details').first().evaluate(el => (el as HTMLDetailsElement).open)) {
        await fieldPanel.getByText('Xem kiểm kê nguồn và thông tin kỹ thuật').click();
      }
      await expect(fieldPanel.getByText(new RegExp(fieldData.summary.generationId))).toBeVisible();
      await fieldPanel.getByText(/Xem từng trường và lọc kết quả/).click();
      await fieldPanel.getByRole('button', { name: /^Khác dữ liệu/ }).click();
      await expect(fieldPanel.getByRole('button', { name: /^Khác dữ liệu/ })).toHaveAttribute('aria-pressed', 'true');
    } else {
      await expect(fieldPanel).toContainText('Chưa có field evidence F42 hợp lệ');
      await expect(sourceCard).toBeVisible();
    }
  } else {
    await expect(page.getByTestId('migration-reconciliation-scroll')).toContainText(/Không có field evidence F42 cho migration run đang chọn|Chưa chọn được migration run VERIFIED/);
  }
  await page.getByRole('button', { name: 'Xem Web Thật (Live Iframe)', exact: true }).click();
  if (snapshot.review?.version) {
    const imageChecks = await page.request.post(
      "/api/admin/qa/website-migrations/images",
      { data: { store, version: snapshot.review.version } },
    );
    expect(imageChecks.status()).toBe(200);
    const imageResults = (await imageChecks.json()).data;
    expect(imageResults.results.length).toBeLessThanOrEqual(4);
    const repeated = (
      await (
        await page.request.post("/api/admin/qa/website-migrations/images", {
          data: { store, version: snapshot.review.version },
        })
      ).json()
    ).data;
    for (const r of repeated.results.filter(
      (r: { check: { sourceHash?: string } }) => r.check.sourceHash,
    )) expect(r.cached).toBe(true);
    expect(
      (
        await page.request.post("/api/admin/qa/website-migrations/images", {
          data: { store, version: snapshot.review.version, url: "http://127.0.0.1/private" },
        })
      ).status(),
    ).toBe(400);
  }
  // The live F42 flow keeps the established F40 inspector shell. It must use
  // F42 URLs instead of the legacy template preview URLs.
  await expect(
    page.getByRole("button", { name: "Xem Web Thật (Live Iframe)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "So Sánh Khối", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Soi CSDL 1-to-1", exact: true }),
  ).toBeVisible();
  const expectedPW1Src =
    typeof snapshot.sourceUrl === "string" && snapshot.sourceUrl.startsWith("https://")
      ? snapshot.sourceUrl
      : "about:blank";
  await expect(page.getByTitle("PW1 Desktop Storefront")).toHaveAttribute(
    "src",
    expectedPW1Src,
  );
  await expect(page.getByTitle("PW1 Desktop Storefront")).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-popups",
  );
  if (snapshot.pages[0]?.url) {
    await expect(page.getByTitle("PW2 Next.js Desktop Storefront")).toHaveAttribute(
      "src",
      snapshot.pages[0].url,
    );
    await page.getByRole("button", { name: "Mobile (375px)", exact: true }).click();
    await expect(page.getByTitle("PW2 Next.js Mobile Storefront")).toBeVisible();
    await page.getByRole("button", { name: "Desktop", exact: true }).click();
    await page.getByRole("button", { name: "Soi CSDL 1-to-1", exact: true }).click();
    await expect(page.getByText("F42 evidence migration", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Xem Web Thật (Live Iframe)", exact: true }).click();
  }

  expect(
    (
      await page.request.post("/api/admin/qa/website-migrations", {
        data: {
          store,
          version: "0".repeat(32),
          verdict: "passed",
          note: "Stale evidence check",
          checks: {
            content: true,
            media: true,
            mapping: true,
            visual: true,
            audit: true,
          },
        },
      })
    ).status(),
  ).toBe(409);
  await page.getByRole("button", { name: "Quay lại danh sách" }).click();
  // TC-F40-MIG-LIVE-03: API and browser empty states never introduce fixtures.
  expect(
    (
      await page.request.get("/api/admin/qa/website-migrations?page=0")
    ).status(),
  ).toBe(400);
  await page
    .getByRole("textbox", { name: "Tìm store" })
    .fill("no-such-store-f40-live-evidence-000");
  await expect(
    page.getByText(
      "Chưa có store migration phù hợp. Không dùng dữ liệu mẫu thay thế.",
    ),
  ).toBeVisible();
}

test("[TC-F40-MIG-LIVE-02] real website migration catalog and evidence", async ({ page, request, baseURL }) => {
  await checkWebsiteMigration({ page, request, baseURL });
});

test("[TC-F40-MIG-LIVE-09] QC dropdown opens in comparison and rejects invalid requests without saving", async ({ page, request, baseURL }) => {
  await checkWebsiteMigration({ page, request, baseURL }, true);
});

test('[TC-F40-MIG-WEB-RATE-02] website percentage uses current content without BE field evidence', async ({ page, baseURL }) => {
  test.setTimeout(120000);
  test.skip(!process.env.DATABASE_URI || !process.env.PAYLOAD_SECRET || !baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Local real-data regression only');
  const db = new Client({ connectionString: process.env.DATABASE_URI });
  await db.connect();
  let admin: number | undefined;
  try { admin = (await db.query("SELECT u.id FROM users u JOIN users_roles r ON r.parent_id=u.id WHERE r.value='super-admin' LIMIT 1")).rows[0]?.id; }
  finally { await db.end(); }
  expect(admin).toBeTruthy();
  const token = await new SignJWT({ id: admin, collection: 'users', mfa_verified: true, roles: ['super-admin'] })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.PAYLOAD_SECRET));
  await page.context().addCookies([{ name: 'payload-token', value: token, url: baseURL! }]);
  const response = await page.request.get('/api/admin/qa/website-migrations?limit=100&page=1');
  expect(response.ok()).toBeTruthy();
  const stores: MigrationStore[] = (await response.json()).data.stores;
  const store = stores.find(item => item.storeId === '3') ?? stores.find(item => (item.websiteComparison?.percentage ?? 0) > 0);
  expect(store?.websiteComparison?.percentage).toBeGreaterThan(0);
  console.log(`Store ${store!.storeId}: ${store!.websiteComparison!.percentage}% (${store!.websiteComparison!.matched}/${store!.websiteComparison!.total} website fields matched)`);
  await page.goto('/studio/qa/migration-diff');
  await expect(page.getByRole('columnheader', { name: /Độ khớp website/ })).toBeVisible({ timeout: 60000 });
  const rate = page.getByTestId(`migration-store-row-${store!.storeId}`).getByTestId('migration-match-rate');
  await expect(rate).toContainText(`${store!.websiteComparison!.percentage}%`, { timeout: 60000 });
  await expect(rate).toContainText(`Khớp ${store!.websiteComparison!.matched}/${store!.websiteComparison!.total} field website`);
});

test('[TC-F40-MIG-LIVE-13] readable block cards display real evidence without saving verdicts', async ({ page, request, baseURL }) => {
  await checkWebsiteMigration({ page, request, baseURL }, false, true);
});

test('[TC-F40-MIG-LIVE-10][TC-F40-MIG-LIVE-16] lifecycle cards match the real catalog and preserve search and pagination filters', async ({ page, request, baseURL }) => {
  await checkWebsiteMigration({ page, request, baseURL }, false, false, true);
});
