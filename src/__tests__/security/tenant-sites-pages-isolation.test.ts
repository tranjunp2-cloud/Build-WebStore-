import { describe, expect, it } from "vitest";
import { Sites } from "@/collections/Sites";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  USER_BETA,
  SUPER_ADMIN_USER,
  createMockTenantReq,
} from "../helpers/tenant-test-harness";

// ── TC-SEC-05: Sites Multi-tenant Access Scoping ───────────────────
describe("[TC-SEC-05] Sites Multi-tenant Isolation", () => {
  it("TC-SEC-05.01: restricts site read queries strictly to the user active tenant", () => {
    // Arrange
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);
    const reqAnon = createMockTenantReq(null);

    // Act
    const readAlpha = typeof Sites.access?.read === "function" ? Sites.access.read({ req: reqAlpha } as any) : undefined;
    const readBeta = typeof Sites.access?.read === "function" ? Sites.access.read({ req: reqBeta } as any) : undefined;
    const readAnon = typeof Sites.access?.read === "function" ? Sites.access.read({ req: reqAnon } as any) : undefined;

    // Assert
    expect(readAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(readBeta).toEqual({ tenant: { in: [TENANT_BETA.id] } });
    expect(readAnon).toBe(false);
  });

  it("TC-SEC-05.02: restricts site update and delete permissions to tenant owners", () => {
    // Arrange
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);

    // Act
    const updateAlpha = typeof Sites.access?.update === "function" ? Sites.access.update({ req: reqAlpha } as any) : undefined;
    const deleteAlpha = typeof Sites.access?.delete === "function" ? Sites.access.delete({ req: reqAlpha } as any) : undefined;

    // Assert
    expect(updateAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
    expect(deleteAlpha).toEqual({ tenant: { in: [TENANT_ALPHA.id] } });
  });

  it("TC-SEC-05.03: grants global access to super-admin for all sites", () => {
    // Arrange
    const reqSuper = createMockTenantReq(SUPER_ADMIN_USER);

    // Act
    const readSuper = typeof Sites.access?.read === "function" ? Sites.access.read({ req: reqSuper } as any) : undefined;
    const updateSuper = typeof Sites.access?.update === "function" ? Sites.access.update({ req: reqSuper } as any) : undefined;
    const deleteSuper = typeof Sites.access?.delete === "function" ? Sites.access.delete({ req: reqSuper } as any) : undefined;

    // Assert
    expect(readSuper).toBe(true);
    expect(updateSuper).toBe(true);
    expect(deleteSuper).toBe(true);
  });
});