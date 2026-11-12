import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { getAiPlatformContextSecret } from "@/lib/ai-platform/config";
import { getAiPlatformConfig } from "@/lib/ai-platform/ai-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/internal/ai-config — server-to-server, read by ai-platform.
 * Auth: `Authorization: Bearer <HS256 JWT>` signed with AI_PLATFORM_CONTEXT_SECRET, iss "ai-platform",
 * aud "prime-web:internal", sub "ai-config", at most 5 minutes old. Anything else: 401 with one fixed body.
 * Returns { prices, images, models, updatedAt } from the `ai_platform_config` plan-features row.
 */
export async function GET(req: Request) {
	const secret = getAiPlatformContextSecret();
	const match = /^Bearer (\S+)$/.exec(req.headers.get("authorization") ?? "");
	if (!secret || !match?.[1]) return unauthorized();
	try {
		await jwtVerify(match[1], new TextEncoder().encode(secret), {
			algorithms: ["HS256"],
			issuer: "ai-platform",
			audience: "prime-web:internal",
			subject: "ai-config",
			maxTokenAge: "5m",
			requiredClaims: ["iat"],
		});
	} catch {
		return unauthorized();
	}
	try {
		return NextResponse.json(await getAiPlatformConfig(), { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("[internal/ai-config] failed", error instanceof Error ? error.message : error);
		return NextResponse.json({ error: "Unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
	}
}
