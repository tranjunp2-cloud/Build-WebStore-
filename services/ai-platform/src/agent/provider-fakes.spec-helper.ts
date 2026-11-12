import { createHash } from "node:crypto";
import { vi } from "vitest";
import { parseEnv } from "../config/env";
import { DecisionService } from "../decide/decision.service";
import { createModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { QuestionFlowService } from "./ask/question-flow";
import { ctx, STAGING_FULL } from "./run-harness.spec-helper";

/**
 * Fake provider APIs for the copilot (TC-AICP-359..360): the real provider SDKs and the production
 * registry / effort wiring run; only `fetch` is faked. Each fake checks the request against rules its
 * API refuses with a 400, then answers in its own wire format.
 */

/** One scripted model step. */
export type Turn =
	| "read" // one site_read
	| "reads2" // two site_read calls in one step
	| "read-text" // a line of text and a site_read in one step
	| "read-invalid" // site_read with input the schema refuses (the SDK answers with a tool error)
	| "redacted" // Claude: redacted thinking before the call (others: a plain read)
	| "truncated" // ran out of output tokens while thinking: no text, unsigned thinking on Claude
	| "markers" // the reply is only an imitated internal marker
	| "silent" // thinking only
	| "silent-empty" // nothing at all
	| "reply"
	| "ask" // ask_user the schema refuses
	| "ask-valid"; // a valid custom ask_user
export type Json = Record<string, any>;
export type ProviderId = "anthropic" | "openai" | "google" | "deepseek" | "compat-local";

export const PROVIDERS: ProviderId[] = ["anthropic", "openai", "google", "deepseek", "compat-local"];
export const MODEL: Record<ProviderId, string> = {
	anthropic: "claude-haiku-5-5",
	openai: "gpt-5.4-mini",
	google: "gemini-3-flash-preview",
	deepseek: "deepseek-v4-flash",
	"compat-local": "qwen3-coder",
};
export const REPLY = "Tôi đã soạn một block mới cho trang Home.";
/** DeepSeek thinks only with an explicit tier effort. */
export const THINKING_DEEPSEEK = { AI_EFFORT_BALANCED: "medium" };
const READ_INPUTS = [
	{ view: "catalog", siteId: "3490", pageId: null, blockId: null, query: null },
	{ view: "page", siteId: "3490", pageId: "11853", blockId: null, query: null },
];
const VALID_ASK = {
	purpose: "custom",
	product: null,
	questions: [{ id: "style", title: "Which style?", why: null, options: [{ value: "a", label: "Bold" }, { value: "b", label: "Calm" }], multiple: false, pictures: null, table: null }],
	language: "vi",
};
const BAD_ASK = { purpose: "custom", product: null, questions: [{ id: "q1", text: "?" }], language: "vi" };

// ── rules each API refuses with a 400 ────────────────────────────────

function anthropicRules(body: Json): string[] {
	const v: string[] = [];
	const blocks = (c: unknown): Json[] => (typeof c === "string" ? [{ type: "text", text: c }] : ((c as Json[]) ?? []));
	const m: Json[] = body.messages;
	const thinking = body.thinking?.type && body.thinking.type !== "disabled";
	const finalAssistant = m.map((x) => x.role).lastIndexOf("assistant");
	if (m[0]?.role !== "user") v.push("first message is not user");
	if (m.at(-1)?.role !== "user") v.push("ends on assistant (prefill not supported)");
	m.forEach((msg, i) => {
		if (i > 0 && msg.role === m[i - 1]?.role) v.push(`two ${msg.role} messages in a row`);
		const b = blocks(msg.content);
		if (b.length === 0) v.push(`${msg.role} message with empty content`);
		if (b.some((x) => x.type === "text" && !String(x.text).trim())) v.push("empty text block");
		if (msg.role === "assistant") {
			const uses = b.filter((x) => x.type === "tool_use");
			const answered = new Set(blocks(m[i + 1]?.content).filter((x) => x.type === "tool_result").map((x) => x.tool_use_id));
			for (const u of uses) if (!answered.has(u.id)) v.push(`tool_use ${u.id} without tool_result after it`);
			if (uses.length && thinking && i === finalAssistant && !["thinking", "redacted_thinking"].includes(b[0]?.type)) v.push("final assistant tool_use turn does not start with a thinking block");
			for (const t of b) {
				if (t.type === "thinking" && !t.signature) v.push("thinking block without signature");
				if (t.type === "redacted_thinking" && !t.data) v.push("redacted_thinking without data");
			}
		} else {
			const asked = new Set(blocks(m[i - 1]?.content).filter((x) => x.type === "tool_use").map((x) => x.id));
			const ids = b.filter((r) => r.type === "tool_result").map((r) => r.tool_use_id);
			for (const id of ids) if (!asked.has(id)) v.push(`tool_result ${id} without tool_use before it`);
			if (new Set(ids).size !== ids.length) v.push("two tool_result blocks for one tool_use");
			const firstOther = b.findIndex((x) => x.type !== "tool_result");
			if (ids.length && firstOther !== -1 && b.slice(firstOther).some((x) => x.type === "tool_result")) v.push("tool_result after other content");
		}
	});
	const usesTools = m.some((msg) => blocks(msg.content).some((x) => x.type === "tool_use" || x.type === "tool_result"));
	if (usesTools && !body.tools?.length) v.push("tool blocks but no tools defined");
	if (thinking && body.tool_choice && !["auto", "none"].includes(body.tool_choice.type)) v.push("thinking allows only tool_choice auto/none");
	return v;
}

/** OpenAI Chat Completions and the servers that copy it (DeepSeek, vLLM / OmniRoute style). */
function chatRules(body: Json, deepseekThinking: boolean): string[] {
	const v: string[] = [];
	const m: Json[] = body.messages;
	const lastUser = m.map((x) => x.role).lastIndexOf("user");
	m.forEach((msg, i) => {
		if (msg.role === "assistant" && msg.tool_calls?.length) {
			const following: string[] = [];
			for (let j = i + 1; j < m.length && m[j]?.role === "tool"; j++) following.push(m[j]?.tool_call_id);
			for (const call of msg.tool_calls) if (!following.includes(call.id)) v.push(`tool_call ${call.id} not followed by its tool message`);
			if (new Set(following).size !== following.length) v.push("two tool messages for one tool_call");
			if (deepseekThinking && i > lastUser && !msg.reasoning_content) v.push("thinking mode: tool-call turn sent back without reasoning_content");
		}
		if (msg.role === "tool") {
			let j = i - 1;
			while (j >= 0 && m[j]?.role === "tool") j--;
			if (!m[j]?.tool_calls?.some((call: Json) => call.id === msg.tool_call_id)) v.push(`tool message ${msg.tool_call_id} without its tool_call`);
		}
		if (msg.role === "assistant" && !msg.tool_calls?.length && !msg.content) v.push("assistant message with no content and no tool_calls");
	});
	if (body.tool_choice && !body.tools?.length) v.push("tool_choice without tools");
	return v;
}

function googleRules(body: Json): string[] {
	const v: string[] = [];
	const c: Json[] = body.contents;
	const lastUserText = c.map((x) => x.role === "user" && x.parts.some((p: Json) => "text" in p)).lastIndexOf(true);
	c.forEach((content, i) => {
		if (!content.parts?.length) v.push(`${content.role} content with no parts`);
		const calls = content.parts.filter((p: Json) => p.functionCall);
		if (content.role === "model" && calls.length) {
			const replies = (c[i + 1]?.parts ?? []).filter((p: Json) => p.functionResponse).length;
			if (replies !== calls.length) v.push(`model turn with ${calls.length} functionCall, next turn has ${replies} functionResponse`);
			// Gemini 3: the first call of each step in this turn carries its signature
			if (i > lastUserText && !calls[0].thoughtSignature) v.push("functionCall in this turn is missing a thought_signature");
		}
		if (content.role === "user" && content.parts.some((p: Json) => p.functionResponse) && !c[i - 1]?.parts?.some((p: Json) => p.functionCall))
			v.push("functionResponse without a functionCall before it");
	});
	return v;
}

// ── answers in each provider's wire format ───────────────────────────

interface Step {
	text?: string;
	calls: Array<{ name: string; input: Json }>;
	thinking: "signed" | "unsigned" | "redacted" | "none";
	stop: "stop" | "tools" | "length";
}

function stepOf(turn: Turn, nextRead: () => Json): Step {
	const read = () => ({ name: "site_read", input: nextRead() });
	switch (turn) {
		case "read":
			return { calls: [read()], thinking: "signed", stop: "tools" };
		case "reads2":
			return { calls: [read(), read()], thinking: "signed", stop: "tools" };
		case "read-text":
			return { text: "Để tôi xem trang.", calls: [read()], thinking: "signed", stop: "tools" };
		case "read-invalid":
			return { calls: [{ name: "site_read", input: { view: "page" } }], thinking: "signed", stop: "tools" };
		case "redacted":
			return { calls: [read()], thinking: "redacted", stop: "tools" };
		case "truncated":
			return { calls: [], thinking: "unsigned", stop: "length" };
		case "markers":
			return { text: 'Earlier in this request I used site_read with {"view":"page"}.', calls: [], thinking: "signed", stop: "stop" };
		case "silent":
			return { calls: [], thinking: "signed", stop: "stop" };
		case "silent-empty":
			return { calls: [], thinking: "none", stop: "stop" };
		case "ask":
			return { calls: [{ name: "ask_user", input: BAD_ASK }], thinking: "signed", stop: "tools" };
		case "ask-valid":
			return { calls: [{ name: "ask_user", input: VALID_ASK }], thinking: "signed", stop: "tools" };
		default:
			return { text: REPLY, calls: [], thinking: "signed", stop: "stop" };
	}
}

const THOUGHT = "Which block fits the home page?";

function anthropicAnswer(s: Step, n: number, usage: Json = { input_tokens: 10, output_tokens: 5 }): Json {
	const content: Json[] = [];
	if (s.thinking === "signed") content.push({ type: "thinking", thinking: THOUGHT, signature: `sig_${n}` });
	// cut off while thinking: the block came back without a usable signature
	if (s.thinking === "unsigned") content.push({ type: "thinking", thinking: THOUGHT, signature: "" });
	if (s.thinking === "redacted") content.push({ type: "redacted_thinking", data: `enc_${n}` });
	if (s.text) content.push({ type: "text", text: s.text });
	s.calls.forEach((c, i) => content.push({ type: "tool_use", id: `toolu_${n}_${i}`, name: c.name, input: c.input }));
	const stop = s.stop === "tools" ? "tool_use" : s.stop === "length" ? "max_tokens" : "end_turn";
	return { id: `msg_${n}`, type: "message", role: "assistant", model: MODEL.anthropic, content, stop_reason: stop, stop_sequence: null, usage };
}

function chatAnswer(s: Step, n: number, reasoning: boolean): Json {
	const message: Json = { role: "assistant", content: s.text ?? (s.calls.length ? null : "") };
	if (reasoning && s.thinking !== "none") message.reasoning_content = THOUGHT;
	if (s.calls.length) message.tool_calls = s.calls.map((c, i) => ({ id: `call_${n}_${i}`, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input) } }));
	const finish = s.stop === "tools" ? "tool_calls" : s.stop === "length" ? "length" : "stop";
	return { id: `chat_${n}`, object: "chat.completion", created: 1, model: "m", choices: [{ index: 0, message, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
}

function googleAnswer(s: Step, n: number): Json {
	const parts: Json[] = [];
	if (s.thinking !== "none") parts.push({ text: THOUGHT, thought: true, ...(s.thinking === "unsigned" ? {} : { thoughtSignature: `ts_${n}` }) });
	if (s.text) parts.push({ text: s.text });
	// Gemini 3 signs the first call of a step only
	s.calls.forEach((c, i) => parts.push({ functionCall: { name: c.name, args: c.input }, ...(i === 0 ? { thoughtSignature: `fs_${n}` } : {}) }));
	const finish = s.stop === "length" ? "MAX_TOKENS" : "STOP";
	return { candidates: [{ content: { role: "model", parts }, finishReason: finish, index: 0 }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } };
}

// ── the fake servers ─────────────────────────────────────────────────

/** Anthropic's prompt cache, simplified: a prefix is cached at each `cache_control` breakpoint and read back when a later request starts with it (≈4 characters a token). */
export interface CacheUse {
	input: number;
	cacheRead: number;
	cacheWrite: number;
}

function anthropicCache(body: Json, cache: Set<string>): CacheUse {
	const blocks: Json[] = [
		...(body.tools ?? []),
		...(Array.isArray(body.system) ? body.system : body.system ? [{ type: "text", text: body.system }] : []),
		...(body.messages as Json[]).flatMap((m) => (typeof m.content === "string" ? [{ role: m.role, type: "text", text: m.content }] : m.content.map((b: Json) => ({ role: m.role, ...b })))),
	];
	const tokens = (from: number, to: number) => Math.ceil(blocks.slice(from, to).reduce((n, b) => n + JSON.stringify({ ...b, cache_control: undefined }).length, 0) / 4);
	const keys: string[] = [];
	const hash = createHash("sha256");
	for (const b of blocks) keys.push(hash.update(JSON.stringify({ ...b, cache_control: undefined })).copy().digest("hex"));
	const breakpoints = blocks.flatMap((b, i) => (b.cache_control ? [i] : []));
	const lastBreakpoint = breakpoints.at(-1) ?? -1;
	let read = -1;
	for (let i = lastBreakpoint; i >= 0; i--) if (cache.has(keys[i] as string)) { read = i; break; }
	for (const b of breakpoints) cache.add(keys[b] as string);
	return { cacheRead: tokens(0, read + 1), cacheWrite: tokens(read + 1, lastBreakpoint + 1), input: tokens(lastBreakpoint + 1, blocks.length) };
}

export interface Seen {
	cache?: CacheUse;
	breakpoints?: number;
	provider: ProviderId;
	body: Json;
	violations: string[];
	copilot: boolean;
	model: string;
}

function providerOf(url: string): ProviderId {
	if (url.includes("anthropic")) return "anthropic";
	if (url.includes("googleapis")) return "google";
	if (url.includes("deepseek")) return "deepseek";
	if (url.includes("compat.test")) return "compat-local";
	return "openai";
}

/** `script` = the copilot steps in order; `down` = the copilot calls [from, to] (1-based, per provider or model id) answered 529 / 503. */
export function fakeServers(script: Turn[], down: Partial<Record<string, [number, number]>> = {}) {
	const seen: Seen[] = [];
	const calls: Partial<Record<string, number>> = {};
	let turn = 0;
	let reads = 0;
	const promptCache = new Set<string>();
	const nextRead = () => READ_INPUTS[reads++ % 2] as Json;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input instanceof Request ? input.url : input);
			const provider = providerOf(url);
			const body = JSON.parse(String(init?.body ?? "{}")) as Json;
			const copilot = Boolean(body.tools?.length);
			const leaked = JSON.stringify(body).includes("echHistory") ? ["internal history marker sent to the provider"] : [];
			const violations = [
				...leaked,
				...(provider === "anthropic"
					? anthropicRules(body)
					: provider === "google"
						? googleRules(body)
						: chatRules(body, provider === "deepseek" && body.thinking?.type === "enabled")),
			];
			const model = String(body.model ?? url.match(/models\/([^:]+):/)?.[1] ?? "");
			seen.push({ provider, body, violations, copilot, model });
			const key = down[model] ? model : provider;
			if (violations.length) return Response.json({ error: { type: "invalid_request_error", message: violations.join("; ") } }, { status: 400 });
			if (copilot) {
				calls[key] = (calls[key] ?? 0) + 1;
				const window = down[key];
				const k = calls[key] ?? 0;
				if (window && k >= window[0] && k <= window[1])
					return Response.json({ error: { type: "overloaded_error", message: "Overloaded" } }, { status: provider === "anthropic" ? 529 : 503, headers: { "retry-after-ms": "1" } });
			}
			const step = stepOf(copilot ? (script[Math.min(turn++, script.length - 1)] as Turn) : "reply", nextRead);
			const n = seen.length;
			const me = seen.at(-1) as Seen;
			if (provider === "anthropic") {
				me.cache = anthropicCache(body, promptCache);
				me.breakpoints = (JSON.stringify(body).match(/"cache_control"/g) ?? []).length;
			}
			const usage = me.cache ? { input_tokens: me.cache.input, cache_read_input_tokens: me.cache.cacheRead, cache_creation_input_tokens: me.cache.cacheWrite, output_tokens: 5 } : undefined;
			const answer = provider === "anthropic" ? anthropicAnswer(step, n, usage) : provider === "google" ? googleAnswer(step, n) : chatAnswer(step, n, provider !== "openai");
			return Response.json(answer);
		}),
	);
	return seen;
}

/** Saves and loads run state as JSON, like the Postgres store (jsonb). */
class JsonStateStore extends InMemoryAgentStore {
	override async saveRunState(organizationId: string, runId: string, state: unknown, onlyWhile?: Parameters<InMemoryAgentStore["saveRunState"]>[3]) {
		return super.saveRunState(organizationId, runId, state == null ? state : JSON.parse(JSON.stringify(state)), onlyWhile);
	}
}

export interface RunOptions {
	down?: Partial<Record<string, [number, number]>>;
	env?: Record<string, string>;
	/** model ids per provider in the chain, when not MODEL's */
	models?: string[];
	flows?: boolean;
	shop?: Partial<ShopTools>;
	/** runs before the copilot starts (e.g. to store an attachment) */
	before?: (store: InMemoryAgentStore) => Promise<void>;
	attachmentIds?: string[];
	prompt?: string;
}

export function copilot(chain: ProviderId[], options: RunOptions = {}) {
	const ref = (p: ProviderId, i: number) => `${p}:${options.models?.[i] ?? MODEL[p]}`;
	const vars: Record<string, string> = {
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		AI_AGENT_CAPABILITIES: STAGING_FULL,
		ANTHROPIC_API_KEY: "k",
		OPENAI_API_KEY: "k",
		GOOGLE_GENERATIVE_AI_API_KEY: "k",
		DEEPSEEK_API_KEY: "k",
		AI_COMPAT_LOCAL_BASE_URL: "http://compat.test/v1",
		AI_COMPAT_LOCAL_API_KEY: "k",
		AI_COMPAT_LOCAL_REASONING: "true",
		AI_MODEL_BALANCED: chain.map(ref).join(", "),
		AI_MODEL_FAST: ref(chain[0] as ProviderId, 0),
		...(chain.includes("deepseek") ? THINKING_DEEPSEEK : {}),
		...options.env,
	};
	const env = parseEnv(vars);
	const store = new JsonStateStore();
	const ledger = { record: async () => undefined, countSince: async () => 0 };
	const shop = {
		siteRead: async (_c: unknown, input: { view: string }) => ({ view: input.view, blocks: [{ id: "hero_1", type: "hero", heading: "Kopi Kampung" }] }),
		...options.shop,
	} as unknown as ShopTools;
	const flows = options.flows ? new QuestionFlowService(shop, new DecisionService(store, ledger, env), store) : undefined;
	const registry = createModelRegistry(env, vars);
	const service = new AgentRunService(store, registry, ledger, env, new AgentThreadService(store, env), flows, shop);
	return { service, store };
}

export async function runCopilot(chain: ProviderId[], script: Turn[], options: RunOptions = {}) {
	const seen = fakeServers(script, options.down);
	const { service, store } = copilot(chain, options);
	await options.before?.(store);
	const frames: RunFrame[] = [];
	const prompt = options.prompt ?? "Thêm block mới cho trang Home";
	const result = await service.start(ctx, { prompt, context: { module: "editor" }, ...(options.attachmentIds ? { attachmentIds: options.attachmentIds } : {}) } as never, (f) => frames.push(f));
	return { result, seen, frames, service, store, refused: () => seen.filter((s) => s.violations.length).map((s) => `${s.provider}: ${s.violations.join("; ")}`) };
}

/** Site reads (their result text) a request carried, whatever form they took. */
export function readsSent(s: Seen | undefined): number {
	return (JSON.stringify(s?.body ?? {}).match(/Kopi Kampung/g) ?? []).length;
}

export function lastCopilot(seen: Seen[]): Seen | undefined {
	return seen.filter((s) => s.copilot).at(-1);
}
