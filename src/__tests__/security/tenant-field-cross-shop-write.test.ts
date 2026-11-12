import { describe, expect, it } from "vitest";
import type { Field, FieldAccess } from "payload";
import { Sites } from "@/collections/Sites";
import { Customers } from "@/collections/Customers";
import {
  TENANT_ALPHA,
  TENANT_BETA,
  USER_ALPHA,
  SUPER_ADMIN_USER,
  createMockTenantReq,
  type MockTenantUser,
} from "../helpers/tenant-test-harness";

// GH-2137: collection `update` access only picks which rows a merchant may edit; the `tenant` field itself must
// refuse another shop, or a merchant creates a site / customer inside another shop or moves their own row there.

function tenantFieldAccess(fields: Field[], op: "create" | "update"): FieldAccess {
  const field = fields.find((f) => "name" in f && f.name === "tenant") as { access?: Record<string, FieldAccess> } | undefined;
  const access = field?.access?.[op];
  if (!access) throw new Error(`no ${op} access on the tenant field`);
  return access;
}

describe.each([
  ["Sites", Sites.fields],
  ["Customers", Customers.fields],
])("[TC-F02.52] %s tenant field — no row written into another shop", (_name, fields) => {
  it("TC-F02.52: accepts the user's own workspace and refuses another shop on create and update", async () => {
    // Arrange
    const create = tenantFieldAccess(fields, "create");
    const update = tenantFieldAccess(fields, "update");
    const req = createMockTenantReq(USER_ALPHA);

    // Act
    const own = await create({ req, siblingData: { tenant: TENANT_ALPHA.id } } as never);
    const other = await create({ req, siblingData: { tenant: TENANT_BETA.id } } as never);
    const move = await update({ req, siblingData: { tenant: { id: TENANT_BETA.id } } } as never);
    const untouched = await update({ req, siblingData: { name: "renamed" } } as never);

    // Assert
    expect(own).toBe(true);
    expect(other).toBe(false);
    expect(move).toBe(false);
    expect(untouched).toBe(true);
  });

  it("TC-F02.52: lets a super-admin write any shop; refuses anonymous and a suspended membership", async () => {
    // Arrange
    const create = tenantFieldAccess(fields, "create");
    const suspended: MockTenantUser = { ...USER_ALPHA, tenants: [{ tenant: TENANT_ALPHA.id, status: "suspended" } as never] };

    // Act
    const admin = await create({ req: createMockTenantReq(SUPER_ADMIN_USER), siblingData: { tenant: TENANT_BETA.id } } as never);
    const anonymous = await create({ req: createMockTenantReq(null), siblingData: { tenant: TENANT_ALPHA.id } } as never);
    const notActive = await create({ req: createMockTenantReq(suspended), siblingData: { tenant: TENANT_ALPHA.id } } as never);

    // Assert
    expect(admin).toBe(true);
    expect(anonymous).toBe(false);
    expect(notActive).toBe(false);
  });
});
