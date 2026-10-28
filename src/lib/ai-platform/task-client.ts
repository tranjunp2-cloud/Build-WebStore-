import "server-only";

import { randomUUID } from "node:crypto";
import { type AiClient, createAiClient } from "@ech/ai-contracts";
import { getAiPlatformUrl } from "./config";
import { type AgentActor, signAgentContextToken } from "./context";
import { currentRequestId, REQUEST_ID_HEADER } from "./request-id";

/**
 * The one door from prime-web server code to a model:
 *   const ai = getAiTaskClient(actor)
 *   const { output } = await ai.runTask("content.translate", { targetLocale: "ms-MY", fields })
 * Provider, model, fallback, quota and ledger are decided by apps/ai-platform.
 */
export function getAiTaskClient(actor: AgentActor, options: { requestId?: string } = {}): AiClient {
	const baseUrl = getAiPlatformUrl();
	if (!baseUrl) throw new Error("AI_PLATFORM_URL is not configured.");
	// every task call carries the id of the request it serves (ai-platform logs), like the agent proxy's calls
	const requestId = options.requestId ?? currentRequestId() ?? randomUUID();
	const fetcher: typeof fetch = (input, init) => {
		const headers = new Headers(init?.headers);
		if (!headers.has(REQUEST_ID_HEADER)) headers.set(REQUEST_ID_HEADER, requestId);
		return fetch(input, { ...init, headers });
	};
	return createAiClient({ baseUrl, token: () => signAgentContextToken(actor), fetcher });
}
