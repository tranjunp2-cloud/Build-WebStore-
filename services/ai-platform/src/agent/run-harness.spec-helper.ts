import { MockLanguageModelV4 } from "ai/test";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { SpendGuard } from "../cost/spend-guard";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";

/** A copilot run against a scripted model (the cost specs, TC-AISEC-080..094). */

export type Call = Parameters<MockLanguageModelV4["doGenerate"]>[0];
export type Turn = { tool: string; input: unknown } | { tools: Array<{ tool: string; input: unknown }> } | { text: string };

export const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my", role: "owner", locale: "en-MY" };

/** The staging release's full set (prime-web's own products, every store capability). */
export const STAGING_FULL =
	"site,blog,stock_photos,media_library,image_generation,shop_products,store_categories,store_discounts,store_customers,campaigns,store_orders,store_reports";

export function scripted(turns: Turn[], cacheRead = 0) {
	let call = 0;
	const usage = {
		inputTokens: { total: 1000, noCache: 1000 - cacheRead, cacheRead, cacheWrite: undefined },
		outputTokens: { total: 20, text: 20, reasoning: undefined },
	};
	return new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			if ("text" in turn) return { content: [{ type: "text" as const, text: turn.text }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
			const calls = "tools" in turn ? turn.tools : [turn];
			return {
				content: calls.map((c, i) => ({ type: "tool-call" as const, toolCallId: `call_${call}_${i}`, toolName: c.tool, input: JSON.stringify(c.input) })),
				finishReason: { unified: "tool-calls" as const, raw: undefined },
				usage,
				warnings: [],
			};
		},
	});
}

export function runHarness(options: {
	turns: Turn[];
	env?: Record<string, string>;
	shop?: Partial<ShopTools>;
	/** the FAST alias (suggestions); default: the same scripted model */
	fast?: MockLanguageModelV4;
	cacheRead?: number;
	spend?: SpendGuard;
}) {
	const model = scripted(options.turns, options.cacheRead ?? 0);
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		AI_AGENT_CAPABILITIES: STAGING_FULL,
		...options.env,
	});
	const store = new InMemoryAgentStore();
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (event) => void recorded.push(event), countSince: async () => 0 };
	const models: ModelRegistry = {
		resolveChain: (alias) => [{ model: alias === "fast" && options.fast ? options.fast : model, provider: "openai", modelId: alias === "fast" ? "gpt-4.1-nano" : "gpt-4.1-mini" }],
	};
	const service = new AgentRunService(
		store,
		models,
		ledger,
		env,
		new AgentThreadService(store, env),
		undefined,
		options.shop as ShopTools | undefined,
		undefined,
		options.spend,
	);
	return { service, model, store, recorded };
}

export const toolNames = (call: Call | undefined) => call?.tools?.map((t) => t.name) ?? [];
export const systemText = (call: Call | undefined) => JSON.stringify(call?.prompt.filter((m) => m.role === "system"));
/** Every tool result the model received in a call, by tool name. */
export function toolResults(call: Call | undefined): Array<{ tool: string; output: unknown }> {
	return (call?.prompt ?? []).flatMap((message) =>
		message.role === "tool" ? message.content.flatMap((part) => (part.type === "tool-result" ? [{ tool: part.toolName, output: part.output }] : [])) : [],
	);
}
