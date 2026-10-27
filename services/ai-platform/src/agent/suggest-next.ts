import type { RunSuggestion } from "@ech/agent-core";
import type { FlowLanguage } from "./ask/flow-copy";
import type { CapabilitySet } from "./merchant-capabilities";
import { messageLanguage } from "./message-language";
import { READ_SHORTCUTS, type ReadShortcut } from "./run-intents";

export const SUGGEST_NEXT_TASK = "agent.suggest-next";

/** A suggestion call is a garnish: it never holds the stream open for long. */
export const SUGGEST_NEXT_TIMEOUT_MS = 6_000;
export const SUGGEST_NEXT_MAX_TOKENS = 160;

const MAX_SUGGESTIONS = 3;
const MAX_CHARS = 80;

/**
 * Appended after the finished conversation, so the call reuses the run's
 * cached prefix (same instructions, tools and messages) and pays only for
 * this line and the short reply.
 */
export const SUGGEST_NEXT_PROMPT = [
	"[Not from the merchant — the dashboard asks:] Suggest the 3 most useful next messages the merchant could send you now, based on this conversation.",
	"Only things you can do with your tools on this dashboard. No repeats of what was just done or asked.",
	"Write each as the merchant would type it, entirely in the language the merchant's own last message was written in (not the website's, the page's or the editor's language, and not the language of your last reply if it differed), under 60 characters. Never mix two languages in one line.",
	"One per line. No numbering, bullets, quotes or other text.",
].join(" ");

/** Model lines → at most three clean, distinct prompts; anything odd is dropped, never shown. */
export function parseSuggestions(text: string, alreadySaid: string): RunSuggestion[] {
	const said = alreadySaid.trim().toLowerCase();
	const seen = new Set<string>();
	const out: RunSuggestion[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const prompt = raw
			.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
			.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
			.trim();
		const key = prompt.toLowerCase();
		if (prompt.length < 4 || prompt.length > MAX_CHARS || seen.has(key) || key === said) continue;
		// a reply that talks instead of listing ("Here are some ideas:") is not a prompt
		if (prompt.endsWith(":")) continue;
		seen.add(key);
		out.push({ prompt, source: "model" });
		if (out.length === MAX_SUGGESTIONS) break;
	}
	return out;
}

// ── cheap suggestions (AI_SUGGEST_MODE) ─────────────────────────────────────
// `rules` (default): built from what the run did (staged cards, the reads it made, the To do list's ready
// prompts) without a model; only when no rule fits, one tiny call on the FAST model (no tools, no
// instructions, the last exchange only). `model`: always that tiny call. `off`: no suggestions.

export type SuggestMode = "rules" | "model" | "off";

export function suggestMode(value: string | undefined): SuggestMode {
	return value === "model" || value === "off" ? value : "rules";
}

/** What a finished run did, as the rules read it. */
export interface RunFacts {
	/** action kinds of the cards staged in this run, in order */
	staged: readonly string[];
	/** read tools the run called, with their input (and the To do list's items) */
	reads: ReadonlyArray<{ tool: string; input?: Record<string, unknown>; value?: unknown }>;
	/** the merchant's message (never suggested back) */
	prompt: string;
	language: FlowLanguage;
	capabilities: CapabilitySet;
}

type Line = Record<FlowLanguage, string>;

const LINES = {
	banner: { en: "Add a homepage banner for this code", ms: "Tambah banner laman utama untuk kod ini", vi: "Thêm banner trang chủ cho mã này" },
	announce: { en: "Write a blog post announcing this code", ms: "Tulis catatan blog tentang kod ini", vi: "Viết bài blog giới thiệu mã này" },
	checkSite: { en: "Check my website before publishing", ms: "Semak laman web saya sebelum terbit", vi: "Kiểm tra website trước khi xuất bản" },
	publish: { en: "Publish my website", ms: "Terbitkan laman web saya", vi: "Xuất bản website của tôi" },
	ordersLeft: { en: "Which orders still need action?", ms: "Pesanan mana yang masih perlu tindakan?", vi: "Đơn hàng nào còn cần xử lý?" },
	leadsWaiting: { en: "Show contact messages still waiting", ms: "Tunjukkan mesej yang masih menunggu", vi: "Xem tin nhắn liên hệ đang chờ" },
} as const satisfies Record<string, Line>;

const shortcut = (name: ReadShortcut): Line => READ_SHORTCUTS[name].text;

/**
 * Up to three next messages from what the run did, in the merchant's language, each one the deployment
 * can do. Fewer than two that fit → [] (the caller may ask the model).
 */
export function ruleSuggestions(facts: RunFacts): RunSuggestion[] {
	const has = (capability: Parameters<CapabilitySet["has"]>[0]) => facts.capabilities.has(capability);
	const reports = has("store_reports");
	const candidates: Line[] = [];
	const add = (line: Line | false) => {
		if (line) candidates.push(line);
	};
	const staged = new Set(facts.staged);
	if (staged.has("store.discounts_patch")) {
		add(has("site") && LINES.banner);
		add(has("blog") && LINES.announce);
		add(reports && shortcut("sales_7_days"));
	}
	if (staged.has("site.publish")) {
		add(reports && shortcut("todos"));
		add(reports && shortcut("sales_today"));
	} else if ([...staged].some((kind) => kind.startsWith("site.") && kind !== "site.publish")) {
		add(LINES.checkSite);
		add(LINES.publish);
	}
	if (staged.has("store.orders_patch")) {
		add(has("store_orders") && LINES.ordersLeft);
		add(reports && shortcut("sales_today"));
	}
	if (staged.has("store.customers_patch")) add(has("store_customers") && LINES.leadsWaiting);
	if (staged.size === 0) {
		for (const read of facts.reads) {
			if (read.tool === "store_todos") {
				// the To do list's own ready prompts, when they are in the merchant's language
				for (const item of todoPrompts(read.value)) if (messageLanguage(item) === facts.language) candidates.push({ en: item, ms: item, vi: item });
			}
			if (read.tool === "store_reports" && reports) {
				const metric = read.input?.metric;
				const period = read.input?.period ?? "last_7_days";
				if (metric === "sales") {
					add(shortcut("top_this_month"));
					add(period !== "last_month" && shortcut("sales_last_month"));
					add(shortcut("todos"));
				} else if (metric === "top_products") {
					add(shortcut("sales_this_month"));
					add(shortcut("todos"));
				} else {
					add(shortcut("sales_7_days"));
					add(shortcut("todos"));
				}
			}
			if (read.tool === "store_orders" && reports) {
				add(shortcut("sales_today"));
				add(shortcut("orders_by_status"));
			}
		}
	}
	const asked = facts.prompt.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
	const seen = new Set<string>();
	const out: RunSuggestion[] = [];
	for (const line of candidates) {
		const prompt = line[facts.language];
		const key = prompt.toLowerCase();
		if (key === asked || seen.has(key) || prompt.length > MAX_CHARS) continue;
		seen.add(key);
		out.push({ prompt, source: "rules" });
		if (out.length === MAX_SUGGESTIONS) break;
	}
	return out.length >= 2 ? out : [];
}

function todoPrompts(value: unknown): string[] {
	const items = (value as { items?: unknown })?.items;
	if (!Array.isArray(items)) return [];
	return items.flatMap((item) => {
		const prompt = (item as { prompt?: unknown })?.prompt;
		return typeof prompt === "string" && prompt.trim() ? [prompt.trim()] : [];
	});
}

/** The tiny suggestion call's static instructions (no tools, no copilot instructions). */
export const SUGGEST_NEXT_SYSTEM = [
	"You suggest what a shop owner could ask their store assistant next, from the last exchange below.",
	"Suggest 3 short next messages (under 60 characters each), written as the merchant would type them, entirely in the language of the merchant's message. Never mix two languages in one line.",
	"Only things the assistant can do (listed below). No repeats of what was just done or asked.",
	"One per line. No numbering, bullets, quotes or other text.",
].join(" ");

/** The tiny call's user turn: the merchant's message, the reply and what the assistant can do (all clipped). */
export function suggestUserTurn(input: { prompt: string; answer: string; staged: readonly string[]; abilities: readonly string[] }): string {
	const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
	return [
		`Merchant: ${clip(input.prompt.replace(/\s+/g, " ").trim(), 500)}`,
		`Assistant: ${clip(input.answer.replace(/\s+/g, " ").trim(), 700)}`,
		input.staged.length > 0 ? `Drafts waiting for approval: ${clip(input.staged.join("; "), 300)}` : null,
		`The assistant can: ${input.abilities.join("; ")}.`,
	]
		.filter(Boolean)
		.join("\n");
}
