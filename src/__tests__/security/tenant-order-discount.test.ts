import { describe, expect, it } from "vitest";
import { Orders } from "@/collections/Orders";
import { Discounts } from "@/collections/Discounts";
import { Customers } from "@/collections/Customers";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  USER_BETA,
  SUPER_ADMIN_USER,
  createMockTenantReq,
} from "../helpers/tenant-test-harness";

describe("[TC-SEC-02] Multi-tenant Order & Discount Security", () => {
  it("enforces strict tenant scoping for order read queries", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);
    const reqAnon = createMockTenantReq(null);

    const readAlpha = typeof Orders.access?.read === "function" ? Orders.access.read({ req: reqAlpha } as any) : undefined;
    const readBeta = typeof Orders.access?.read === "function" ? Orders.access.read({ req: reqBeta } as any) : undefined;
    const readAnon = typeof Orders.access?.read === "function" ? Orders.access.read({ req: reqAnon } as any) : undefined;

    expect(readAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(readBeta).toEqual({ tenant: { in: [TENANT_BETA.id] } });
    expect(readAnon).toBe(false);
  });

  it("blocks order deletion for all tenants to maintain financial audit integrity", () => {
    const deleteAccess = typeof Orders.access?.delete === "function" ? Orders.access.delete({} as any) : undefined;
    expect(deleteAccess).toBe(false);
  });

  it("enforces tenant-scoped customer read access", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);

    const readAlpha = typeof Customers.access?.read === "function" ? Customers.access.read({ req: reqAlpha } as any) : undefined;
    const readBeta = typeof Customers.access?.read === "function" ? Customers.access.read({ req: reqBeta } as any) : undefined;

    expect(readAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(readBeta).toEqual({ tenant: { in: [TENANT_BETA.id] } });
  });

  it("prevents creating discounts under another tenant's namespace (Discount beforeChange guard)", async () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const beforeChangeHooks = Discounts.hooks?.beforeChange || [];
    expect(beforeChangeHooks.length).toBeGreaterThan(0);

    const maliciousDiscount = {
      code: "SUMMER50",
      type: "percentage",
      value: 50,
      tenant: TENANT_BETA.id,
    };

    let threw = false;
    try {
      for (const hook of beforeChangeHooks) {
        await hook({
          data: maliciousDiscount,
          req: reqAlpha,
          operation: "create",
        } as any);
      }
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain("permission");
    }

    expect(threw).toBe(true);
  });

  it("allows super-admin to manage discounts across all tenants", async () => {
    const reqSuper = createMockTenantReq(SUPER_ADMIN_USER);
    const beforeChangeHooks = Discounts.hooks?.beforeChange || [];

    const discountData = {
      code: "GLOBAL10",
      type: "percentage",
      value: 10,
      tenant: TENANT_BETA.id,
    };

    let currentData = { ...discountData };
    for (const hook of beforeChangeHooks) {
      const res = await hook({
        data: currentData,
        req: reqSuper,
        operation: "create",
      } as any);
      if (res) currentData = res as any;
    }

    expect(currentData.tenant).toBe(TENANT_BETA.id);
  });
});