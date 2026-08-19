import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {
    current: { id: 7, email: "qa-smoke@example.invalid" } as {
      id: number;
      email: string;
    } | null,
  },
  payload: {
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => mocks.payload) }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mocks.user.current),
  tenantIdForQuery: vi.fn(() => 77),
}));
vi.mock("@/lib/utils/storefront-url", () => ({
  buildStorefrontUrl: vi.fn(() => "https://e2e.example.test"),
}));

import { NextRequest } from "next/server";
import { getPayload } from "payload";
import { POST } from "@/app/api/e2e/targeted-smoke-fixture/route";

const originalAppEnv = process.env.APP_ENV;
const originalTestEmail = process.env.TEST_EMAIL;

function fixtureRequest(dispatchId?: string) {
  const headers = new Headers({
    "x-e2e-fixture-intent": "targeted-smoke-fixture-v1",
  });
  if (dispatchId) headers.set("x-targeted-dispatch-id", dispatchId);
  return new NextRequest("http://localhost/api/e2e/targeted-smoke-fixture", {
    method: "POST",
    headers,
  });
}

describe("[TC-F40-08-05] targeted Smoke fixture lease boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_ENV = "staging";
    process.env.TEST_EMAIL = "qa-smoke@example.invalid";
    mocks.user.current = { id: 7, email: "qa-smoke@example.invalid" };
    mocks.payload.findByID.mockImplementation(
      async ({ collection }: { collection: string }) => {
        if (collection === "tenants")
          return { id: 77, slug: "e2e-targeted-smoke" };
        return null;
      },
    );
    mocks.payload.find.mockResolvedValue({ docs: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalAppEnv;
    if (originalTestEmail === undefined) delete process.env.TEST_EMAIL;
    else process.env.TEST_EMAIL = originalTestEmail;
  });

  it("rejects an unauthenticated fixture request before Payload access", async () => {
    // Arrange
    mocks.user.current = null;

    // Act
    const response = await POST(fixtureRequest("42"));

    // Assert
    expect(response.status).toBe(401);
    expect(getPayload).not.toHaveBeenCalled();
    expect(mocks.payload.create).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed targeted dispatch lease before fixture mutation", async () => {
    // Arrange
    const requests = [fixtureRequest(), fixtureRequest("not-a-dispatch")];

    // Act
    const responses = await Promise.all(
      requests.map((request) => POST(request)),
    );

    // Assert
    expect(responses.map((response) => response.status)).toEqual([409, 409]);
    await expect(
      Promise.all(responses.map((response) => response.json())),
    ).resolves.toEqual([
      { error: "Active targeted fixture lease is required" },
      { error: "Active targeted fixture lease is required" },
    ]);
    expect(mocks.payload.findByID).toHaveBeenCalledTimes(2);
    expect(mocks.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "tenants" }),
    );
    expect(mocks.payload.findByID).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: "qa_smoke_dispatches" }),
    );
    expect(mocks.payload.create).not.toHaveBeenCalled();
    expect(mocks.payload.update).not.toHaveBeenCalled();
    expect(mocks.payload.delete).not.toHaveBeenCalled();
  });

  it("allows only a dispatched, unexpired matching lease to reach fixture provisioning", async () => {
    // Arrange
    mocks.payload.findByID.mockImplementation(
      async ({ collection }: { collection: string }) => {
        if (collection === "tenants")
          return { id: 77, slug: "e2e-targeted-smoke" };
        if (collection === "qa_smoke_dispatches")
          return {
            id: 42,
            status: "dispatched",
            fixtureKey: "smoke-e2e-targeted-tenant",
          };
        return null;
      },
    );
    mocks.payload.find.mockImplementation(
      async ({ collection }: { collection: string }) => {
        if (collection === "qa_fixture_leases")
          return { docs: [{ expiresAt: "2099-01-01T00:00:00.000Z" }] };
        if (collection === "sites") return { docs: [] };
        return { docs: [] };
      },
    );

    // Act
    const response = await POST(fixtureRequest("42"));

    // Assert
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Fixture site is unavailable; provision the E2E tenant first",
    });
    expect(mocks.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "qa_fixture_leases" }),
    );
    expect(mocks.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "sites" }),
    );
    expect(mocks.payload.create).not.toHaveBeenCalled();
    expect(mocks.payload.update).not.toHaveBeenCalled();
    expect(mocks.payload.delete).not.toHaveBeenCalled();
  });
});
