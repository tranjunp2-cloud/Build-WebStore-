/**
 * Health check endpoint — 2 modes:
 *
 * GET /api/health        → lightweight 200 OK + deployed commit identity (no DB)
 * GET /api/health?deep=1 → full diagnostic (DB, env, version, uptime)
 *
 * Deep mode is for dev team debugging — never expose secrets.
 */
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get("deep");

  // ── Lightweight mode (DO health check) ──
  if (!deep) {
    return Response.json({
      status: "ok",
      timestamp: Date.now(),
      // Vercel system metadata; safe to expose and required by CI to avoid
      // attaching test evidence to a SHA that has not reached the staging alias.
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
  }

  // ── Deep diagnostic mode ──
  const result: Record<string, unknown> = {
    status: "ok",
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    node: process.version,
    env: process.env.NODE_ENV,
    region: process.env.DO_REGION || "unknown",
    version: process.env.NEXT_PUBLIC_BUILD_ID || "dev",
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  };

  // ── DB check ──
  try {
    const { getPayload } = await import("payload");
    const payload = await getPayload({
      config: (await import("@/payload.config")).default,
    });
    const start = Date.now();
    await payload.find({ collection: "users", limit: 1, depth: 0 });
    result.db = {
      status: "connected",
      latency: Date.now() - start,
    };
  } catch (e) {
    result.db = {
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
    result.status = "degraded";
  }

  // ── Env check (which required vars are set, no values exposed) ──
  const requiredEnvs = [
    "DATABASE_URI",
    "PAYLOAD_SECRET",
    "NEXT_PUBLIC_SERVER_URL",
    "STRIPE_SECRET_KEY",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "OPENAI_API_KEY",
  ];
  result.envCheck = requiredEnvs.reduce(
    (acc, key) => {
      acc[key] = process.env[key] ? "✅" : "❌ MISSING";
      return acc;
    },
    {} as Record<string, string>,
  );

  const statusCode = result.status === "ok" ? 200 : 503;
  return Response.json(result, { status: statusCode });
}
