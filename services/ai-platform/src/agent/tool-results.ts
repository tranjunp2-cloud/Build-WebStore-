/**
 * What a read tool's result feeds back to the model (cost). Every tool result is re-sent on each later
 * step of the run, so a big one is paid several times. Three cuts, all lossless for the model's job:
 *
 * 1. Repeats: a large part of a result that an earlier read of this run already returned (the shop's
 *    category list on every product read / search, the sales definition, a long note, the section
 *    catalog) is replaced by a pointer to that earlier result, which is still in the conversation.
 * 2. Fields the model never sends back: a website section's `version` hash (prime-web re-reads and
 *    guards the version itself when a change is prepared).
 * 3. Size: a result over `MAX_RESULT_CHARS` has long texts clipped (with a "[cut: …]" note) and long
 *    lists shortened (with how many were left out), tighter until it fits.
 *
 * Pictures never reach the model here: `readTool` already moves `media` / `records` to the chat.
 */

/** A result larger than this (serialized) is shortened. ≈6 k tokens. */
export const MAX_RESULT_CHARS = 24_000;
/** Parts smaller than this are never replaced by a pointer (a pointer is ~80 characters). */
const REPEAT_MIN_CHARS = 400;
/** How deep repeats are looked for (result → field → list item → field). */
const REPEAT_DEPTH = 3;
/** Keys dropped wherever they appear in a site_read result. */
const SITE_READ_DROP = new Set(["version"]);

/**
 * Reads whose result goes to the model as it is. Not the fresh reads a change is drafted from
 * ("content.check", "site.check"): their data goes into the change set, never shortened.
 */
export const SHAPED_TOOLS: ReadonlySet<string> = new Set([
	"site.read",
	"content.read",
	"content.search",
	"inventory.read",
	"store.categories",
	"store.discounts",
	"store.orders",
	"store.customers",
	"store.reports",
	"store.todos",
]);

/** What one run has already fed the model: part fingerprint → the read it came with. */
export type ResultMemory = Map<string, string>;

export function createResultMemory(): ResultMemory {
	return new Map();
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Fingerprint of a part: its JSON (parts are compared whole; the length keeps the key short to compare). */
function fingerprint(json: string): string {
	let hash = 0;
	for (let i = 0; i < json.length; i += 1) hash = (Math.imul(31, hash) + json.charCodeAt(i)) | 0;
	return `${json.length}:${hash >>> 0}:${json.slice(0, 40)}`;
}

/**
 * Replaces parts (fields and list items down to `REPEAT_DEPTH`) that an earlier read of this run — or an
 * earlier part of this result — already returned byte for byte, and remembers the large parts it keeps.
 */
function dropRepeats(value: Record<string, unknown>, memory: ResultMemory, label: string): Record<string, unknown> {
	const visit = (part: unknown, depth: number): unknown => {
		if (depth > 0) {
			const json = JSON.stringify(part) ?? "";
			if (json.length >= REPEAT_MIN_CHARS) {
				const id = fingerprint(json);
				const earlier = memory.get(id);
				if (earlier) return `(unchanged: same as shown earlier in your ${earlier} result)`;
				memory.set(id, label);
			}
		}
		if (depth >= REPEAT_DEPTH) return part;
		if (Array.isArray(part)) return part.map((item) => visit(item, depth + 1));
		if (isRecord(part)) return Object.fromEntries(Object.entries(part).map(([key, item]) => [key, visit(item, depth + 1)]));
		return part;
	};
	return visit(value, 0) as Record<string, unknown>;
}

function dropKeys(value: unknown, keys: ReadonlySet<string>): unknown {
	if (Array.isArray(value)) return value.map((item) => dropKeys(item, keys));
	if (!isRecord(value)) return value;
	return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)).map(([key, part]) => [key, dropKeys(part, keys)]));
}

/** Long texts clipped to `maxText`, lists to `maxItems` (with a marker saying how many were left out). */
function clip(value: unknown, maxText: number, maxItems: number): unknown {
	if (typeof value === "string") {
		return value.length > maxText ? `${value.slice(0, maxText)}… [cut: ${maxText} of ${value.length} characters]` : value;
	}
	if (Array.isArray(value)) {
		const kept = value.slice(0, maxItems).map((item) => clip(item, maxText, maxItems));
		return value.length > maxItems ? [...kept, `… ${value.length - maxItems} more not shown (narrow the read to see them)`] : kept;
	}
	if (!isRecord(value)) return value;
	return Object.fromEntries(Object.entries(value).map(([key, part]) => [key, clip(part, maxText, maxItems)]));
}

const STEPS: ReadonlyArray<[number, number]> = [
	[4_000, 60],
	[1_500, 30],
	[600, 15],
	[200, 8],
];

function fit(value: Record<string, unknown>, max: number): Record<string, unknown> {
	if (JSON.stringify(value).length <= max) return value;
	let shaped = value;
	for (const [text, items] of STEPS) {
		shaped = clip(value, text, items) as Record<string, unknown>;
		if (JSON.stringify(shaped).length <= max) break;
	}
	return { ...shaped, shortened: "This result was long, so long texts and lists were cut. Read one item or narrow the read for the rest." };
}

/**
 * The model's view of one read result. `tool` is the receipt tool name ("site.read", "content.read",
 * "store.orders"…); `memory` lives for one request of a run.
 */
export function shapeToolResult(tool: string, value: unknown, memory: ResultMemory, max = MAX_RESULT_CHARS): unknown {
	if (!SHAPED_TOOLS.has(tool) || !isRecord(value) || "error" in value) return value;
	let shaped = tool === "site.read" ? (dropKeys(value, SITE_READ_DROP) as Record<string, unknown>) : value;
	shaped = dropRepeats(shaped, memory, tool.replace(/\./g, "_").replace(/^content_read$/, "read_item").replace(/^content_search$/, "search_items"));
	return fit(shaped, max);
}
