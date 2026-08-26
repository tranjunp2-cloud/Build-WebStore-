import { describe, expect, it } from "vitest";
import { Subscribers } from "@/collections/Subscribers";
import { Customers } from "@/collections/Customers";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  USER_BETA,
  SUPER_ADMIN_USER,
  createMockTenantReq,
} from "../helpers/tenant-test-harness";

// ── TC-SEC-06: Marketing & Customers Multi-tenant Security ─────────
describe("[TC-SEC-06] Marketing Subscribers & Customers Security", () => {
  it("TC-SEC-06.01: blocks unauthenticated and tenant-level reads to raw subscribers table", () => {
    // Arrange
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqAnon = createMockTenantReq(null);
    const reqSuper = createMockTenantReq(SUPER_ADMIN_USER);

    // Act
    const readAlpha = typeof Subscribers.access?.read === "function" ? Subscribers.access.read({ req: reqAlpha } as any) : undefined;
    const readAnon = typeof Subscribers.access?.read === "function" ? Subscribers.access.read({ req: reqAnon } as any) : undefined;
    const readSuper = typeof Subscribers.access?.read === "function" ? Subscribers.access.read({ req: reqSuper } as any) : undefined;

    // Assert
    expect(readAlpha).toBe(false);
    expect(readAnon).toBe(false);
    expect(readSuper).toBe(true);
  });

  it("TC-SEC-06.02: enforces tenant isolation on Customers collection", () => {
    // Arrange
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);

    // Act
    const readAlpha = typeof Customers.access?.read === "function" ? Customers.access.read({ req: reqAlpha } as any) : undefined;
    const readBeta = typeof Customers.access?.read === "function" ? Customers.access.read({ req: reqBeta } as any) : undefined;

    // Assert
    expect(readAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(readBeta).toEqual({ tenant: { in: [TENANT_BETA.id] } });
  });
});