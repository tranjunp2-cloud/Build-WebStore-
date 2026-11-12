import type { NextRequest } from "next/server";
import { handleAgentProxy } from "@/lib/ai-platform/agent-proxy";

// Streams agent runs (SSE) and applies approved drafts — needs Node + time.
// 300 s = ai-platform's function limit: a run it still works on must not be cut by this proxy first.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteParams = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, { params }: RouteParams) {
	const { path = [] } = await params;
	return handleAgentProxy(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
