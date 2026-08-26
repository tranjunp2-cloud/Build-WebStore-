import { describe, expect, it } from "vitest";
import { BlogCategories } from "@/collections/BlogCategories";
import { Analytics } from "@/collections/Analytics";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  USER_BETA,
  createMockTenantReq,
} from "../helpers/tenant-test-harness";

describe("[TC-SEC-03] Multi-tenant Content & Analytics Boundaries", () => {
  it("enforces tenant-scoped access for Blog Categories read, update, and delete", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);

    const readAlpha = typeof BlogCategories.access?.read === "function" ? BlogCategories.access.read({ req: reqAlpha } as any) : undefined;
    const updateAlpha = typeof BlogCategories.access?.update === "function" ? BlogCategories.access.update({ req: reqAlpha } as any) : undefined;
    const deleteAlpha = typeof BlogCategories.access?.delete === "function" ? BlogCategories.access.delete({ req: reqAlpha } as any) : undefined;

    expect(readAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(updateAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(deleteAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
  });

  it("enforces tenant-scoped access for Analytics events", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);

    const readAlpha = typeof Analytics.access?.read === "function" ? Analytics.access.read({ req: reqAlpha } as any) : undefined;
    const readBeta = typeof Analytics.access?.read === "function" ? Analytics.access.read({ req: reqBeta } as any) : undefined;

    expect(readAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(readBeta).toEqual({ tenant: { in: [TENANT_BETA.id] } });
  });
});