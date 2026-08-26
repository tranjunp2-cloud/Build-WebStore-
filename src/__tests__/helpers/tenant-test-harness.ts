import type { PayloadRequest } from "payload";

export interface MockTenantUser {
  id: string | number;
  email: string;
  roles?: string[];
  tenants: Array<{
    tenant: string | number | { id: string | number; slug?: string };
    roles?: string[];
  }>;
}

export const TENANT_ALPHA = {
  id: "tenant-alpha-101",
  slug: "tenant-alpha",
  name: "Merchant Alpha Store",
};

export const TENANT_BETA = {
  id: "tenant-beta-202",
  slug: "tenant-beta",
  name: "Merchant Beta Store",
};

export const USER_ALPHA: MockTenantUser = {
  id: "user-alpha-1",
  email: "admin@tenant-alpha.local",
  roles: ["user"],
  tenants: [
    {
      tenant: { id: TENANT_ALPHA.id, slug: TENANT_ALPHA.slug },
      roles: ["tenant-admin"],
    },
  ],
};

export const USER_BETA: MockTenantUser = {
  id: "user-beta-2",
  email: "admin@tenant-beta.local",
  roles: ["user"],
  tenants: [
    {
      tenant: { id: TENANT_BETA.id, slug: TENANT_BETA.slug },
      roles: ["tenant-admin"],
    },
  ],
};

export const SUPER_ADMIN_USER: MockTenantUser = {
  id: "user-super-admin-999",
  email: "superadmin@primeweb.local",
  roles: ["super-admin"],
  tenants: [],
};

export function createMockTenantReq(
  user: MockTenantUser | null,
  customPayload: Record<string, unknown> = {},
): PayloadRequest {
  return {
    user: user as unknown as PayloadRequest["user"],
    payload: {
      find: async () => ({ docs: [], totalDocs: 0 }),
      findByID: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      ...customPayload,
    } as unknown as PayloadRequest["payload"],
    headers: new Headers(),
  } as unknown as PayloadRequest;
}