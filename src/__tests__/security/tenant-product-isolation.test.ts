import { describe, expect, it } from "vitest";
import { Products } from "@/collections/Products";
import { Categories } from "@/collections/Categories";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  USER_BETA,
  SUPER_ADMIN_USER,
  createMockTenantReq,
} from "../helpers/tenant-test-harness";

describe("[TC-SEC-01] Multi-tenant Product & Category Isolation", () => {
  it("restricts product read queries strictly to the user's active tenant", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);
    const reqSuper = createMockTenantReq(SUPER_ADMIN_USER);
    const reqAnonymous = createMockTenantReq(null);

    const accessAlpha = typeof Products.access?.read === "function" ? Products.access.read({ req: reqAlpha } as any) : undefined;
    const accessBeta = typeof Products.access?.read === "function" ? Products.access.read({ req: reqBeta } as any) : undefined;
    const accessSuper = typeof Products.access?.read === "function" ? Products.access.read({ req: reqSuper } as any) : undefined;
    const accessAnon = typeof Products.access?.read === "function" ? Products.access.read({ req: reqAnonymous } as any) : undefined;

    expect(accessAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(accessBeta).toEqual({ tenant: { in: [TENANT_BETA.id] } });
    expect(accessSuper).toBe(true);
    expect(accessAnon).toBe(false);
  });

  it("restricts product update and delete access to tenant owners", async () => {
    // Arrange: Mock payload with active plan subscription and product_management feature
    const mockPayloadWithSub = {
      find: async ({ collection }: { collection: string }) => {
        if (collection === "plan-subscriptions") {
          return {
            docs: [
              {
                id: "sub-1",
                plan: "PROFESSIONAL_TM_USER",
                status: "active",
                endsAt: new Date(Date.now() + 86400000).toISOString(),
              },
            ],
            totalDocs: 1,
          };
        }
        if (collection === "plan-features") {
          return {
            docs: [{ value: "YES" }],
            totalDocs: 1,
          };
        }
        return { docs: [], totalDocs: 0 };
      },
    };
    const reqAlpha = createMockTenantReq(USER_ALPHA, mockPayloadWithSub);
    const reqBeta = createMockTenantReq(USER_BETA, mockPayloadWithSub);

    // Act
    const updateAlpha = typeof Products.access?.update === "function" ? await Products.access.update({ req: reqAlpha } as any) : undefined;
    const deleteAlpha = typeof Products.access?.delete === "function" ? await Products.access.delete({ req: reqAlpha } as any) : undefined;

    // Assert: update and delete filter by the actor's tenant ID
    expect(updateAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(deleteAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
  });

  it("prevents cross-tenant re-homing during product updates (beforeChange hook)", async () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const beforeChangeHooks = Products.hooks?.beforeChange || [];
    expect(beforeChangeHooks.length).toBeGreaterThan(0);

    const originalDoc = {
      id: "prod-101",
      name: "Alpha T-Shirt",
      tenant: TENANT_ALPHA.id,
      site: "site-alpha-1",
    };

    const maliciousData = {
      name: "Alpha T-Shirt Renamed",
      tenant: TENANT_BETA.id,
      site: "site-beta-2",
    };

    let currentData = { ...maliciousData };
    for (const hook of beforeChangeHooks) {
      const result = await hook({
        data: currentData,
        req: reqAlpha,
        operation: "update",
        originalDoc,
      } as any);
      if (result) currentData = result as any;
    }

    expect(currentData.tenant).toBe(TENANT_ALPHA.id);
  });

  it("restricts category read queries strictly to the actor's tenant", () => {
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);

    const accessAlpha = typeof Categories.access?.read === "function" ? Categories.access.read({ req: reqAlpha } as any) : undefined;
    const accessBeta = typeof Categories.access?.read === "function" ? Categories.access.read({ req: reqBeta } as any) : undefined;

    expect(accessAlpha).toEqual({
      and: [{ tenant: { in: [TENANT_ALPHA.id] } }, { deletedAt: { exists: false } }],
    });
    expect(accessBeta).toEqual({
      and: [{ tenant: { in: [TENANT_BETA.id] } }, { deletedAt: { exists: false } }],
    });
  });
});