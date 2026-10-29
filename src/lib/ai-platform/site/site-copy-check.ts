import "server-only";

import { BLOCKED_CONTENT, GENERIC_PHRASE_BLACKLIST, GENERIC_PHRASES_BY_LANG, isVagueCTALabel, UNVERIFIABLE_CLAIMS } from "@/lib/ai/content-rules";
import { blockName, isMediaKey, type PageBlock } from "./site-blocks";
import type { PagePatchOp } from "./site-patch";

/**
 * Anti-slop for the web builder copilot: text it writes onto a page is checked
 * for filler that fits any shop ("Vì sao chọn chúng tôi?", "elevate your…"),
 * claims a visitor can't check ("tốt nhất", "#1"), vague button labels
 * ("Xem thêm", "Submit") and shouting (!!, a row of emoji). Only text the edit
 * adds is checked — what the page already says is the merchant's.
 */

export type CopyNote = { where: string; text: string; why: string };

const LABEL_KEYS = /^(label|ctaLabel|ctaText|buttonText)$/;
/** keys that hold links, ids, settings or icons — not copy */
const NOT_COPY = /(url|href|link|id|ids|icon|style|variant|color|colour|layout|mode|locale|platform|currency|type)$/i;

const PHRASES = [...BLOCKED_CONTENT, ...GENERIC_PHRASE_BLACKLIST, ...Object.values(GENERIC_PHRASES_BY_LANG).flat()];
const EMOJI = /\p{Extended_Pictographic}/gu;

function quote(text: string): string {
	const clean = text.replace(/\s+/g, " ").trim();
	return `“${clean.length > 70 ? `${clean.slice(0, 69)}…` : clean}”`;
}

/** Why one piece of copy reads as slop, or null. */
export function copyProblem(key: string, text: string): string | null {
	const lower = text.toLowerCase();
	const phrase = PHRASES.find((p) => lower.includes(p));
	if (phrase) return `filler that fits any shop (“${phrase}”): say what is true of this shop`;
	const claim = UNVERIFIABLE_CLAIMS.find((re) => re.test(text));
	if (claim) return "a claim visitors can't check: only with a fact the merchant gave";
	if (LABEL_KEYS.test(key) && isVagueCTALabel(text)) return "a vague button label: say what happens (e.g. “Xem bộ sưu tập Raya”, “Đặt lịch may”)";
	if (/!{2,}/.test(text) || (text.match(EMOJI)?.length ?? 0) >= 3) return "shouting (!! or a row of emoji)";
	return null;
}

/** Every string a value holds with its key (copy only: no links, ids, icons or pictures). */
function strings(value: unknown, key: string, path: string, into: Array<{ key: string; path: string; text: string }>) {
	if (typeof value === "string") {
		if (!NOT_COPY.test(key) && value.trim()) into.push({ key, path, text: value });
	} else if (Array.isArray(value)) value.forEach((item, i) => strings(item, key, `${path}.${i}`, into));
	else if (value && typeof value === "object") {
		for (const [k, v] of Object.entries(value)) if (!isMediaKey(k) && k !== "id" && k !== "blockType") strings(v, k, path ? `${path}.${k}` : k, into);
	}
	return into;
}

/** The copy an op writes, with where it goes. */
function opCopy(op: PagePatchOp): Array<{ key: string; path: string; text: string }> {
	switch (op.op) {
		case "set_fields":
			return strings(op.fields, "", "", []);
		case "set_value":
			return typeof op.value === "string" ? [{ key: op.path.split(".").pop() ?? "", path: op.path, text: op.value }] : [];
		case "edit_list":
			return op.rows.flatMap((row, i) => strings(row.fields ?? {}, "", `${op.path}.${i}`, []));
		case "insert_block":
			return strings(op.block, "", "", []);
		default:
			return [];
	}
}

/** Copy notes for a page edit: only text that is not on the page already. */
export function copyNotes(before: PageBlock[], ops: PagePatchOp[], pageLabel: string): CopyNote[] {
	const onPage = new Set(strings(before, "", "", []).map((s) => s.text.trim()));
	const byId = new Map(before.map((block) => [String(block.id ?? ""), block]));
	const notes: CopyNote[] = [];
	for (const op of ops) {
		const block = "blockId" in op ? byId.get(op.blockId) : op.op === "insert_block" ? (op.block as PageBlock) : undefined;
		const section = block ? blockName(block) : "section";
		for (const { key, path, text } of opCopy(op)) {
			if (onPage.has(text.trim())) continue;
			const why = copyProblem(key, text);
			if (why) notes.push({ where: `${section} · ${pageLabel} → ${path}`, text: quote(text), why });
		}
	}
	return notes.slice(0, 12);
}

/** Slop already on a section (site_read view "check"): the first few, with their path. */
export function sectionCopyNotes(block: PageBlock, max = 3): Array<{ path: string; text: string; why: string }> {
	const notes: Array<{ path: string; text: string; why: string }> = [];
	for (const { key, path, text } of strings(block, "", "", [])) {
		const why = copyProblem(key, text);
		if (why) notes.push({ path, text: quote(text), why });
		if (notes.length >= max) break;
	}
	return notes;
}

/** What the model is told when it wrote slop: rewrite, or confirm the merchant's own words. */
export function copyRefusal(notes: CopyNote[]): { error: { code: string; message: string } } {
	const lines = notes.slice(0, 6).map((n) => `${n.where}: ${n.text} — ${n.why}`);
	return {
		error: {
			code: "generic_copy",
			message: `This copy reads like filler. ${lines.join("; ")}. Rewrite it with what is specific to this shop (products, place, prices, how things work) from what the merchant told you or the site already says — or ask them in one short question. If these are the merchant's own words, send the same change again with keepWording: true.`,
		},
	};
}

/** The card's notes when the merchant's words are kept on purpose. */
export function copyGuardrails(notes: CopyNote[]) {
	return notes.map((n) => ({ rule: "copy_check", ok: false, detail: `${n.where}: ${n.text} — ${n.why}.` }));
}
