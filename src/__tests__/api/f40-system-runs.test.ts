import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    create: vi.fn().mockResolvedValue({ id: 99 }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    update: vi.fn().mockResolvedValue({}),
  })),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: 1, roles: ["super-admin"] })),
}));

import { GET, POST } from "@/app/api/admin/qa/system-runs/route";
import { POST as CANCEL_POST } from "@/app/api/admin/qa/system-runs/[id]/cancel/route";

describe("[API] /api/admin/qa/system-runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes a full system preflight audit when receiving POST request", async () => {
    const request = new NextRequest("http://localhost/api/admin/qa/system-runs", {
      method: "POST",
      body: JSON.stringify({ scope: "all", profile: "smoke" }),
    });

    const response = await POST(request, { params: {} });
    expect(response.status).toBe(202);

    const body = (await response.json()) as { data?: { totalTargets: number; status: string } };
    expect(body.data?.totalTargets).toBe(67);
    expect(body.data?.status).toBe("audit_only");
  });

  it("handles GET request gracefully", async () => {
    const getReq = new NextRequest("http://localhost/api/admin/qa/system-runs", { method: "GET" });
    const getRes = await GET(getReq, { params: {} });
    expect(getRes.status).toBe(200);
  });

  it("cancels an active audit via POST /[id]/cancel", async () => {
    const cancelReq = new NextRequest("http://localhost/api/admin/qa/system-runs/test-batch/cancel", {
      method: "POST",
    });
    const cancelRes = await CANCEL_POST(cancelReq, { params: { id: "test-batch" } });
    expect(cancelRes.status).toBe(200);

    const cancelBody = (await cancelRes.json()) as { data?: { status: string } };
    expect(cancelBody.data?.status).toBe("cancelled");
  });
});
