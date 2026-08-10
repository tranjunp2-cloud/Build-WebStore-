import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/qa/targeted-start/route";

const originalSecret = process.env.QA_INGEST_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.QA_INGEST_SECRET;
  else process.env.QA_INGEST_SECRET = originalSecret;
});

describe("[TC-F40-03-02] Targeted Smoke workflow claim boundary", () => {
  it("rejects an oversized chunked body before signature or database work", async () => {
    // Arrange
    process.env.QA_INGEST_SECRET = "test-secret";
    const request = new NextRequest("http://localhost/api/admin/qa/targeted-start", {
      method: "POST",
      body: "x".repeat(10_001),
      headers: { "content-type": "application/json" },
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Payload too large" });
  });
});
