import { describe, expect, it } from "vitest";
import { Notifications } from "@/collections/Notifications";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  USER_BETA,
  SUPER_ADMIN_USER,
  createMockTenantReq,
} from "../helpers/tenant-test-harness";

// ── TC-SEC-07: Notifications & System Scoping ───────────────────────
describe("[TC-SEC-07] Notifications Multi-tenant & User Boundaries", () => {
  it("TC-SEC-07.01: restricts notification reads strictly to the user own ID and tenant", () => {
    // Arrange
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqBeta = createMockTenantReq(USER_BETA);
    const reqAnon = createMockTenantReq(null);

    // Act
    const readAlpha = typeof Notifications.access?.read === "function" ? Notifications.access.read({ req: reqAlpha } as any) : undefined;
    const readBeta = typeof Notifications.access?.read === "function" ? Notifications.access.read({ req: reqBeta } as any) : undefined;
    const readAnon = typeof Notifications.access?.read === "function" ? Notifications.access.read({ req: reqAnon } as any) : undefined;

    // Assert
    expect(readAlpha).toEqual({
      and: [
        { user: { equals: USER_ALPHA.id } },
        { tenant: { in: [TENANT_ALPHA.id] } },
      ],
    });
    expect(readBeta).toEqual({
      and: [
        { user: { equals: USER_BETA.id } },
        { tenant: { in: [TENANT_BETA.id] } },
      ],
    });
    expect(readAnon).toBe(false);
  });

  it("TC-SEC-07.02: restricts notification update (mark read) to the notification owner", () => {
    // Arrange
    const reqAlpha = createMockTenantReq(USER_ALPHA);

    // Act
    const updateAlpha = typeof Notifications.access?.update === "function" ? Notifications.access.update({ req: reqAlpha } as any) : undefined;

    // Assert
    expect(updateAlpha).toEqual({
      and: [
        { user: { equals: USER_ALPHA.id } },
        { tenant: { in: [TENANT_ALPHA.id] } },
      ],
    });
  });

  it("TC-SEC-07.03: prevents non-super-admin users from creating or deleting notifications directly", () => {
    // Arrange
    const reqAlpha = createMockTenantReq(USER_ALPHA);
    const reqSuper = createMockTenantReq(SUPER_ADMIN_USER);

    // Act
    const createAlpha = typeof Notifications.access?.create === "function" ? Notifications.access.create({ req: reqAlpha } as any) : undefined;
    const deleteAlpha = typeof Notifications.access?.delete === "function" ? Notifications.access.delete({ req: reqAlpha } as any) : undefined;
    const createSuper = typeof Notifications.access?.create === "function" ? Notifications.access.create({ req: reqSuper } as any) : undefined;
    const deleteSuper = typeof Notifications.access?.delete === "function" ? Notifications.access.delete({ req: reqSuper } as any) : undefined;

    // Assert
    expect(createAlpha).toBe(false);
    expect(deleteAlpha).toBe(false);
    expect(createSuper).toBe(true);
    expect(deleteSuper).toBe(true);
  });
});