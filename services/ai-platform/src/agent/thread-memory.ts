import type { ModelMessage } from "ai";
import type { ThreadRunRecord } from "./agent-store";

/**
 * Conversation memory for a copilot thread. History is append-only and
 * rebuilt from what each run stored at the time (the exact user turn it sent,
 * its final answer, the titles of the drafts it staged) — never from state that
 * changes later (decision status) — so turn N's prefix replays byte-for-byte on
 * turn N+1 and providers' prefix caches keep hitting after the static
 * system prompt + tools.
 *
 * Bounded by whole turns: oldest turns drop first. Follow-up: compact the
 * dropped turns into a stored summary instead of forgetting them.
 */
export const THREAD_HISTORY_MAX_TURNS = 20;
export const THREAD_HISTORY_MAX_CHARS = 24_000;

const TITLE_MAX_CHARS = 60;
const PREVIEW_MAX_CHARS = 160;

export interface ThreadTurn {
	user: string;
	assistant: string;
}

function collapse(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/**
 * Request phrasing that says nothing about the chat ("please", "create a
 * product:", "viết bài blog về") — dropped from the start of a title.
 */
const TITLE_LEADS: readonly RegExp[] = [
	/^(please|pls|hi|hey|hello|ok|okay)\b[,!.\s]*/i,
	/^(can|could|would|will) you\s+(please\s+)?/i,
	/^(help me|i want to|i'd like to|i need to)\s+/i,
	/^(create|make|draft|add|write|generate|build|prepare)\s+(me\s+)?(a|an|the|some|\d+)?\s*((new|short|long|quick|simple|detailed|friendly|seo)\s+)*(draft\s+)?(products?|blog posts?|blog|articles?|posts?|listings?)\b\s*(about|for|on|from|of|:|-|–)?\s*/i,
	/^(hãy\s+|giúp\s+(tôi|mình)\s+)?(tạo|viết|làm|soạn)\s+(giúp\s+)?(một\s+|1\s+|các\s+)?(sản phẩm|bài blog|bài viết|bài)\s*(mới\s*)?(về|cho|:|-)?\s*/i,
	/^(tolong\s+)?(cipta|tulis|buat|sediakan)\s+(satu\s+)?(produk|artikel blog|artikel|catatan blog|blog)\s*(tentang|untuk|:|-)?\s*/i,
];

function cutAtWord(text: string, max: number): string {
	if (text.length <= max) return text;
	const slice = text.slice(0, max);
	const space = slice.lastIndexOf(" ");
	return `${(space >= max * 0.6 ? slice.slice(0, space) : slice).replace(/[\s,;:–-]+$/, "")}…`;
}

/**
 * Thread title from its first prompt, without a model call: request
 * phrasing dropped, the first clause kept, ≤60 chars cut at a word.
 * "Create a product: oversized cotton shirt, grey and ivory…" → "Oversized cotton shirt".
 * A staged draft later replaces it with the draft's own name (`draftTitle`).
 */
export function threadTitle(prompt: string): string {
	const full = collapse(prompt);
	// asides like "(about 400 words)" describe the task, not the subject
	let text = collapse(full.replace(/\s*\([^)]{0,60}\)/g, " "));
	for (const lead of TITLE_LEADS) text = text.replace(lead, "");
	// the first sentence, then the first clause when it is long enough to name the chat;
	// "from this photo and the size chart." names the files, not the chat — use what follows
	const sentences = text.split(/(?<=[.!?。])\s|\n/).filter((x) => x.trim());
	const aboutFiles = /^(from\s+)?(this|these|the|my|attached)\b.{0,40}\b(photos?|pictures?|images?|files?|charts?|pdf|csv|spreadsheets?|ảnh|hình|tệp)\b/i;
	text = (sentences.length > 1 && aboutFiles.test(sentences[0] ?? "") ? sentences[1] : sentences[0]) ?? text;
	const clause = text.split(/[,;(]\s/)[0] ?? text;
	if (clause.length >= 12) text = clause;
	text = text.replace(/[\s.,;:!?–-]+$/, "").trim();
	if (text.length < 3) text = full;
	if (!text) return "New chat";
	return cutAtWord(text.charAt(0).toUpperCase() + text.slice(1), TITLE_MAX_CHARS);
}

const NEW_PRODUCT: Record<string, string> = { vi: "sản phẩm mới", ms: "produk baharu" };
const NEW_PRODUCTS: Record<string, string> = { vi: "sản phẩm mới", ms: "produk baharu" };

/** "Oversized Cotton Shirt — new product": the title a chat earns once it knows what it is making. */
export function productTitle(name: string, locale?: string): string {
	const suffix = NEW_PRODUCT[(locale ?? "en").slice(0, 2)] ?? "new product";
	return cutAtWord(`${collapse(name)} — ${suffix}`, TITLE_MAX_CHARS);
}

/** Title from what a run staged (draft names are already written by the model — no extra call). */
export function draftTitle(
	drafts: ReadonlyArray<{ type: "product"; name: string } | { type: "blog"; title: string } | { type: "inventory"; action: string } | { type: "product_edit"; name: string }>,
	locale?: string,
): string | null {
	const [first] = drafts;
	// an edit keeps the chat's name: it made nothing new
	if (!first || first.type === "product_edit") return null;
	if (first.type === "inventory") return cutAtWord(collapse(first.action), TITLE_MAX_CHARS);
	if (first.type === "blog") return cutAtWord(collapse(first.title), TITLE_MAX_CHARS);
	if (drafts.length === 1) return productTitle(first.name, locale);
	const suffix = NEW_PRODUCTS[(locale ?? "en").slice(0, 2)] ?? "new products";
	return cutAtWord(
		`${drafts.length} ${suffix}: ${drafts.map((d) => (d.type === "product" || d.type === "product_edit" ? d.name : d.type === "blog" ? d.title : d.action)).join(", ")}`,
		TITLE_MAX_CHARS,
	);
}

/** List preview from the latest prompt, ≤160 chars. */
export function threadPreview(prompt: string): string {
	const text = collapse(prompt);
	return text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd()}…` : text;
}

const STAGED_SUMMARY_MAX_CHARS = 200;

/**
 * The static line a staged change set leaves in history: its id, title and
 * summary (e.g. the product names) — all fixed at staging, so the line never changes.
 */
export function stagedLine(changeSet: { id: string; title: string; summary?: string }): string {
	const summary = collapse(changeSet.summary ?? "");
	const detail =
		summary && !changeSet.title.includes(summary)
			? ` — ${summary.length > STAGED_SUMMARY_MAX_CHARS ? `${summary.slice(0, STAGED_SUMMARY_MAX_CHARS - 1).trimEnd()}…` : summary}`
			: "";
	return `[Staged draft ${changeSet.id}: ${changeSet.title}${detail}]`;
}

type StagedRef = { id: string; title: string; summary?: string };

/**
 * One finished run as a (user, assistant) pair; null when the run left nothing
 * to remember (still running, or failed before answering or staging).
 */
/** The merchant's clarifying answers of a finished run, fixed once the run is over. */
export function answeredLine(answers: ReadonlyArray<{ label: string; display: string; source: string }>): string | null {
	const given = answers.filter((a) => a.source !== "skipped" && a.display);
	if (given.length === 0) return null;
	return `[Answered: ${given.map((a) => `${a.label} = ${collapse(a.display)}${a.source === "auto" ? " (picked from catalog)" : ""}`).join("; ")}]`;
}

/**
 * `unanswered`: the run still waits on the merchant's answer, but they wrote a
 * new message instead — it is a turn of the chat (what they asked for, what was
 * found), with the open question noted, or "replace it with those" loses both.
 */
export function runTurn(record: ThreadRunRecord, staged: ReadonlyMap<string, StagedRef>, unanswered = false): ThreadTurn | null {
	const { run, userMessage } = record;
	// a run still waiting on the merchant is not a finished turn yet
	if (!userMessage || (run.status === "awaiting_input" && !unanswered)) return null;
	const lines = run.changeSetIds.flatMap((id) => {
		const changeSet = staged.get(id);
		return changeSet ? [stagedLine(changeSet)] : [];
	});
	const question = run.status === "awaiting_input" && run.ask?.question.title ? collapse(run.ask.question.title).slice(0, 200) : null;
	const asked = question ? `[Asked the merchant: ${question} — not answered; their next message came instead]` : null;
	const parts = [answeredLine(run.answers ?? []), run.answer?.trim(), asked, ...lines].filter((part): part is string =>
		Boolean(part),
	);
	if (parts.length === 0) return null;
	return { user: userMessage, assistant: parts.join("\n") };
}

/** Keeps the newest whole turns within the turn and character budgets. */
export function boundTurns(
	turns: readonly ThreadTurn[],
	limits: { maxTurns: number; maxChars: number } = {
		maxTurns: THREAD_HISTORY_MAX_TURNS,
		maxChars: THREAD_HISTORY_MAX_CHARS,
	},
): ThreadTurn[] {
	const kept: ThreadTurn[] = [];
	let chars = 0;
	for (let i = turns.length - 1; i >= 0 && kept.length < limits.maxTurns; i -= 1) {
		const turn = turns[i] as ThreadTurn;
		const size = turn.user.length + turn.assistant.length;
		if (chars + size > limits.maxChars) break;
		chars += size;
		kept.unshift(turn);
	}
	return kept;
}

/**
 * Earlier runs of the thread (oldest first) → the history messages that precede
 * the new user turn. A run still waiting on an answer counts: the new message
 * came instead of the answer.
 */
export function historyMessages(
	records: readonly ThreadRunRecord[],
	staged: ReadonlyMap<string, StagedRef>,
): ModelMessage[] {
	const turns = records.flatMap((record) => {
		const turn = runTurn(record, staged, true);
		return turn ? [turn] : [];
	});
	return boundTurns(turns).flatMap((turn): ModelMessage[] => [
		{ role: "user", content: turn.user },
		{ role: "assistant", content: turn.assistant },
	]);
}

/** Staged change sets by id, for the staged lines. */
export function stagedById(changeSets: readonly StagedRef[]): Map<string, StagedRef> {
	return new Map(changeSets.map((cs) => [cs.id, cs]));
}

