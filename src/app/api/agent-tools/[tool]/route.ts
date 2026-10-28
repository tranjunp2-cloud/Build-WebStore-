import type { NextRequest } from "next/server";
import { handleAgentTool } from "@/lib/ai-platform/agent-tools/handle-agent-tool";

// Server-to-server: ai-platform reads the shop's catalog/media for the copilot.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 90: drafting a page translation runs the translator for every section (site.prepare_translate)
export const maxDuration = 90;

type RouteParams = { params: Promise<{ tool: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
	const { tool } = await params;
	return handleAgentTool(req, tool);
}
