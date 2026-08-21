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
  it("restricts Media updates to non-stock source provider files for authenticated users", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqAnon = createMockTenantReq(null);

    const updateAlpha = typeof Media.access?.update === "function" ? Media.access.update({ req: reqAlpha } as any) : undefined;
    const updateAnon = typeof Media.access?.update === "function" ? Media.access.update({ req: reqAnon } as any) : undefined;

    expect(updateAlpha).toEqual({
      or: [
        { sourceProvider: { exists: false } },
        { sourceProvider: { not_in: ["wikimedia", "pixabay"] } },
      ],
    });
    expect(updateAnon).toBe(false);
  });

  it("restricts Media deletion to non-stock source provider files", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqAnon = createMockTenantReq(null);

    const deleteAlpha = typeof Media.access?.delete === "function" ? Media.access.delete({ req: reqAlpha } as any) : undefined;
    const deleteAnon = typeof Media.access?.delete === "function" ? Media.access.delete({ req: reqAnon } as any) : undefined;

    expect(deleteAlpha).toEqual({
      or: [
        { sourceProvider: { exists: false } },
        { sourceProvider: { not_in: ["wikimedia", "pixabay"] } },
      ],
    });
    expect(deleteAnon).toBe(false);
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