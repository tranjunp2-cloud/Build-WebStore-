import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { SignJWT } from "jose";

test.use({ trace: "off", screenshot: "off", video: "off" });
test("[TC-F40-MIG-LIVE-02] real website migration catalog and evidence", async ({
  page,
  request,
  baseURL,
}) => {
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
  const catalog = await page.request.get(
    "/api/admin/qa/website-migrations?limit=1",
  );
  expect(catalog.status()).toBe(200);
  const data = (await catalog.json()).data;
  test.skip(!data.stores.length, "No migrated stores in fixture DB");
  const store = data.stores[0].storeId;
  await page.getByTestId(`migration-store-compare-${store}`).click();
  await expect(
    page.getByRole("dialog", { name: "Đối soát store" }),
  ).toBeVisible();
  const detail = await page.request.get(
    "/api/admin/qa/website-migrations?store=" + store,
  );
  expect(detail.status()).toBe(200);
  const snapshot = (await detail.json()).data;
  expect(snapshot.storeId).toBe(store);
  const imageChecks = await page.request.post(
    "/api/admin/qa/website-migrations/images",
    { data: { store, version: snapshot.review.version } },
  );
  expect(imageChecks.status()).toBe(200);
  const imageResults = (await imageChecks.json()).data;
  expect(imageResults.results.length).toBeLessThanOrEqual(4);
  console.info(
    "Image audit trial:",
    JSON.stringify({
      store,
      total: imageResults.total,
      statuses: imageResults.results.map(
        (r: { check: { status: string } }) => r.check.status,
      ),
    }),
  );
  const repeated = (
    await (
      await page.request.post("/api/admin/qa/website-migrations/images", {
        data: { store, version: snapshot.review.version },
      })
    ).json()
  ).data;
  for (const r of repeated.results.filter(
    (r: { check: { sourceHash?: string } }) => r.check.sourceHash,
  ))
    expect(r.cached).toBe(true);
  expect(
    (
      await page.request.post("/api/admin/qa/website-migrations/images", {
        data: { store, version: "0".repeat(32) },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await page.request.post("/api/admin/qa/website-migrations/images", {
        data: {
          store,
          version: snapshot.review.version,
          url: "http://127.0.0.1/private",
        },
      })
    ).status(),
  ).toBe(400);
  const runImages = page.getByRole("button", {
    name: "Kiểm tra lại ảnh",
    exact: true,
  });
  await expect(runImages).toBeEnabled({ timeout: 60000 });
  await expect(page.getByLabel("Tiến độ kiểm tra ảnh")).toContainText(
    "cặp ảnh",
  );
  await expect(
    page.getByRole("region", { name: "Kiểm tra ảnh tự động" }),
  ).toHaveCount(0);

  if (snapshot.pages.length) {
    await page.getByRole("button", { name: "Mở so sánh website" }).click();
    await expect(page.getByTitle("PW2 page hiện tại")).toHaveAttribute(
      "src",
      snapshot.pages[0].url,
    );
    await page.getByLabel("Kích thước so sánh").selectOption("mobile");
    await expect(page.getByTitle("PW2 page hiện tại")).toHaveAttribute(
      "width",
      "390",
    );
    await page.getByRole("button", { name: "Ẩn so sánh website" }).click();
  }
  await page
    .getByRole("button", { name: "Nội dung / mapping / settings", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Đối soát store" }),
  ).toContainText("Input hash:");
  const imageBlock = snapshot.pages
    .flatMap(
      (p: {
        blocks: Array<{
          sourceId: string;
          fields: Array<{ field: string; source: string }>;
        }>;
      }) => p.blocks,
    )
    .find((b: { fields: Array<{ field: string; source: string }> }) =>
      b.fields.some(
        (f) => f.field.endsWith(".image") && f.source.includes('"url"'),
      ),
    );
  if (imageBlock) {
    const blockSummary = page
      .locator("summary")
      .filter({ hasText: `#${imageBlock.sourceId} · block` })
      .first();
    await blockSummary.click();
    const blockPanel = blockSummary.locator("..");
    await expect(
      blockPanel.locator('[aria-label^="Kiểm tra ảnh "]').first(),
    ).toContainText(
      /Cùng file ảnh|Cùng nội dung pixel|cần review|Không kiểm tra được/,
    );
    await expect(
      blockPanel.getByText("Chi tiết dữ liệu", { exact: true }).first(),
    ).toBeVisible();
    const automaticBadge = blockPanel
      .getByText(
        /^(Cùng file ảnh|Cùng nội dung pixel|Tương đồng cao — cần review|Khác ảnh — cần review|Không kiểm tra được)$/,
      )
      .first();
    await expect(automaticBadge).toBeVisible();
    const confirmImage = blockPanel
      .getByRole("button", { name: "Xác nhận thủ công: ảnh đúng", exact: true })
      .first();
    await confirmImage.click();
    await expect(
      blockPanel.getByText("Khớp — xác nhận thủ công", { exact: true }).first(),
    ).toBeVisible();
    await expect(automaticBadge).not.toBeVisible();
    await page
      .getByRole("button", { name: "Website song song", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Nội dung / mapping / settings",
        exact: true,
      })
      .click();
    const reopenedSummary = page
      .locator("summary")
      .filter({ hasText: `#${imageBlock.sourceId} · block` })
      .first();
    await reopenedSummary.click();
    await expect(
      reopenedSummary
        .locator("..")
        .getByText("Khớp — xác nhận thủ công", { exact: true })
        .first(),
    ).toBeVisible();
    await reopenedSummary
      .locator("..")
      .getByRole("button", { name: "Huỷ xác nhận ảnh", exact: true })
      .first()
      .click();
    await expect(
      reopenedSummary
        .locator("..")
        .getByText("Khớp — xác nhận thủ công", { exact: true }),
    ).toHaveCount(0);
    const zoom = blockPanel
      .locator('button[aria-label^="Phóng to ảnh PW1"]')
      .first();
    if (await zoom.count()) {
      await zoom.click();
      await expect(
        page.getByRole("heading", { name: "Ảnh PW1", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
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
  if (snapshot.attemptId) {
    const reviewNote = `F40 browser verification ${Date.now()}`;
    await page
      .getByRole("button", { name: "Đánh giá QC", exact: true })
      .click();
    await page.getByLabel("Ghi chú kiểm chứng (bắt buộc)").fill(reviewNote);
    try {
      await page
        .getByRole("button", { name: "Lưu đánh giá QC", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Đối soát store" }),
      ).toContainText("Store " + store);
      await page
        .getByRole("button", { name: "Đánh giá QC", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Đối soát store" }),
      ).toContainText(reviewNote);
      const updated = (
        await (
          await page.request.get(
            "/api/admin/qa/website-migrations?store=" + store,
          )
        ).json()
      ).data;
      expect(updated.review.current).toBe(true);
      expect(updated.review.verdict).toBe("warning");
      const revise = new Client({ connectionString: process.env.DATABASE_URI });
      await revise.connect();
      try {
        await revise.query(
          "UPDATE pw1_migration_qa_reviews SET evidence_version=$3 WHERE source_store_id=$1 AND note=$2",
          [store, reviewNote, "0".repeat(32)],
        );
      } finally {
        await revise.end();
      }
      const stale = (
        await (
          await page.request.get(
            "/api/admin/qa/website-migrations?store=" + store,
          )
        ).json()
      ).data;
      expect(stale.review.current).toBe(false);
      const staleCatalog = (
        await (
          await page.request.get(
            "/api/admin/qa/website-migrations?search=" + store + "&limit=100",
          )
        ).json()
      ).data;
      expect(
        staleCatalog.stores.find(
          (item: { storeId: string }) => item.storeId === store,
        ).qcStatus,
      ).toBe("unverified");
      const invalidPass = await page.request.post(
        "/api/admin/qa/website-migrations",
        {
          data: {
            store,
            version: updated.review.version,
            verdict: "passed",
            note: "Missing required checks",
            checks: {
              content: false,
              media: false,
              mapping: false,
              visual: false,
              audit: false,
            },
          },
        },
      );
      expect(invalidPass.status()).toBe(400);
    } finally {
      const cleanup = new Client({
        connectionString: process.env.DATABASE_URI,
      });
      await cleanup.connect();
      try {
        await cleanup.query(
          "DELETE FROM pw1_migration_qa_reviews WHERE source_store_id=$1 AND note=$2",
          [store, reviewNote],
        );
      } finally {
        await cleanup.end();
      }
    }
  }
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
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
});
