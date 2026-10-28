
import { AiWorkSchema, mergeWork, type WorkList, WorkStateInputSchema } from "@ech/agent-core";
import { type NextRequest, NextResponse } from "next/server";
import type { AgentActor } from "../context";
import { aiPlatformJson, callAiPlatform } from "../upstream";
import { aiWorkItems } from "./ai-work-items";
import { loadShopWork } from "./shop-work-sources";
import type { WorkLocale } from "./work-format";
import { resolveWorkLocale } from "./work-locale";

/**
 * GET /api/agent/work — the merchant's one ranked work queue: the shop part
 * (platform-api, cached a minute) and the assistant part (ai-platform
 * `agent/work`) read side by side; a side that fails leaves the list `partial`.
 * PUT /api/agent/work/state/<key> — the merchant's Later / Don't remind me.
 */

const NO_STORE = { "cache-control": "private, no-store" };
/** "shop:orders_to_confirm", "ai:review:<threadId>", "ai:ask:<runId>" — never a path. */
const WORK_KEY = /^(shop|ai):[A-Za-z0-9_:.-]{1,116}$/;
const STATE_ROUTE = /^work\/state\/([^/]+)$/;

/** The merged, ranked queue for one actor (the route and the dashboard's To do card both read it). */
export async function buildWorkList(
	actor: AgentActor,
	token: string,
	locale: WorkLocale,
	now: Date,
	options: { signal?: AbortSignal; siteId?: string | null } = {},
): Promise<WorkList> {
	const [ai, shop] = await Promise.allSettled([
		// a slow platform must not pin the 60 s poll: past 8 s the shop part shows alone (partial)
		aiPlatformJson<unknown>({ method: "GET", path: "/agent/work", token, signal: options.signal, timeoutMs: 8_000 }).then((body) => AiWorkSchema.parse(body)),
		loadShopWork(actor, locale, now, { siteId: options.siteId }),
	]);
	if (ai.status === "rejected") console.warn("[work] assistant part unavailable", ai.reason instanceof Error ? ai.reason.message : ai.reason);
	if (shop.status === "rejected") console.warn("[work] shop part unavailable", shop.reason instanceof Error ? shop.reason.message : shop.reason);
	const aiWork = ai.status === "fulfilled" ? ai.value : null;
	const shopWork = shop.status === "fulfilled" ? shop.value : null;
	const items = mergeWork(shopWork?.items ?? [], aiWork ? aiWorkItems(aiWork, locale) : [], aiWork?.tasks ?? [], aiWork?.states ?? []);
	const partial = !aiWork || !shopWork || shopWork.partial;
	return { items, states: aiWork?.states ?? [], checkedAt: now.toISOString(), ...(partial ? { partial: true } : {}) };
}

export async function getWorkList(req: NextRequest, actor: AgentActor, token: string): Promise<Response> {
	const body = await buildWorkList(actor, token, resolveWorkLocale(req, actor), new Date(), { signal: req.signal });
	return NextResponse.json(body, { headers: NO_STORE });
}

/** The work-state key a PUT names, or null when the path is not a work-state route. */
export function workStateKey(path: string): string | null {
	const raw = path.match(STATE_ROUTE)?.[1];
	if (!raw) return null;
	let key: string;
	try {
		key = decodeURIComponent(raw);
	} catch {
		return null;
	}
	return WORK_KEY.test(key) ? key : null;
}

export async function putWorkState(req: NextRequest, token: string, key: string): Promise<Response> {
	let input: unknown;
	try {
		input = JSON.parse((await req.text()) || "{}");
	} catch {
		return NextResponse.json({ title: "Request failed", status: 400, detail: "The body must be JSON." }, { status: 400, headers: NO_STORE });
	}
	const state = WorkStateInputSchema.safeParse(input);
	if (!state.success) {
		return NextResponse.json({ title: "Request failed", status: 422, detail: "Not a valid work state." }, { status: 422, headers: NO_STORE });
	}
	const upstream = await callAiPlatform({
		method: "PUT",
		path: `/agent/work/state/${encodeURIComponent(key)}`,
		token,
		body: JSON.stringify(state.data),
		signal: req.signal,
	});
	return new Response([204, 205, 304].includes(upstream.status) ? null : upstream.body, {
		status: upstream.status,
		headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", ...NO_STORE },
	});
}
