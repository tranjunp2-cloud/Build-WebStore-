import { describe, expect, it } from "vitest";
import { Media } from "@/collections/Media";
import { Blogs } from "@/collections/Blogs";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  USER_BETA,
  createMockTenantReq,
} from "../helpers/tenant-test-harness";

describe("[TC-SEC-04] Multi-tenant Media & Blog Isolation", () => {
  it("[TC-PERF-144] restricts Media updates to the files of the user's own workspace, stock pictures saved for it included", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqAnon = createMockTenantReq(null);

    const updateAlpha = typeof Media.access?.update === "function" ? Media.access.update({ req: reqAlpha } as any) : undefined;
    const updateAnon = typeof Media.access?.update === "function" ? Media.access.update({ req: reqAnon } as any) : undefined;

    // TC-PERF-144 + TC-AIREL-216: the member's own tenant only (was any shop's media) — including stock pictures
    // saved for that shop; the shared stock library and legacy rows (no tenant) stay out of reach
    expect(updateAlpha).toEqual({
      tenant: { in: [TENANT_ALPHA.id] },
    });
    expect(updateAnon).toBe(false);
  });

  it("[TC-PERF-144] restricts Media deletion to the files of the user's own workspace, stock pictures saved for it included", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqAnon = createMockTenantReq(null);

    const deleteAlpha = typeof Media.access?.delete === "function" ? Media.access.delete({ req: reqAlpha } as any) : undefined;
    const deleteAnon = typeof Media.access?.delete === "function" ? Media.access.delete({ req: reqAnon } as any) : undefined;

    // TC-PERF-144 + TC-AIREL-216: the member's own tenant only (was any shop's media) — including stock pictures
    // saved for that shop; the shared stock library and legacy rows (no tenant) stay out of reach
    expect(deleteAlpha).toEqual({
      tenant: { in: [TENANT_ALPHA.id] },
    });
    expect(deleteAnon).toBe(false);
  });

  it("[TC-PERF-144] Media read: public rows for everyone, private rows (receipts) only within the member's tenant", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqAnon = createMockTenantReq(null);

    const readAlpha = typeof Media.access?.read === "function" ? Media.access.read({ req: reqAlpha } as any) : undefined;
    const readAnon = typeof Media.access?.read === "function" ? Media.access.read({ req: reqAnon } as any) : undefined;

    expect(readAnon).toEqual({ private: { not_equals: true } });
    expect(readAlpha).toEqual({ or: [{ private: { not_equals: true } }, { tenant: { in: [TENANT_ALPHA.id] } }] });
  });

  it("restricts Blog post read queries strictly to the actor's tenant", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);

    const readAlpha = typeof Blogs.access?.read === "function" ? Blogs.access.read({ req: reqAlpha } as any) : undefined;
    const readBeta = typeof Blogs.access?.read === "function" ? Blogs.access.read({ req: reqBeta } as any) : undefined;

    expect(readAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(readBeta).toEqual({ tenant: { in: [TENANT_BETA.id] } });
  });

  it("prevents relocating blog posts into another tenant (beforeChange hook)", async () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const beforeChangeHooks = Blogs.hooks?.beforeChange || [];
    expect(beforeChangeHooks.length).toBeGreaterThan(0);

    const originalDoc = {
      id: "blog-101",
      title: "Alpha Blog Post",
      tenant: TENANT_ALPHA.id,
    };

    const maliciousData = {
      title: "Alpha Blog Post Tampered",
      tenant: TENANT_BETA.id,
    };

    let currentData = { ...maliciousData };
    for (const hook of beforeChangeHooks) {
      const res = await hook({
        data: currentData,
        req: reqAlpha,
        operation: "update",
        originalDoc,
      } as any);
      if (res) currentData = res as any;
    }

    expect(currentData.tenant).toBe(TENANT_ALPHA.id);
  });
});