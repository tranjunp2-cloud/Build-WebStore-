import type { FlowLanguage } from "./ask/flow-copy";
import { confidentLanguage, LANGUAGE_REQUESTED } from "./message-language";

/**
 * Edited website text keeps the language of the text it replaces. The model sometimes writes the new text in the
 * language of the chat (the earlier turns were Malay) although the page is English; the merchant then reads an
 * English reply that quotes one sentence while the card stages another. This is the platform's check on the drafted
 * diffs, so the page never changes language by accident:
 * - the page's language is the language of the old text when that is clear, else the editor's language;
 * - new text that is clearly another language is refused once, with the language it must be in;
 * - not refused: the merchant's own words (the new text is in their message), a request that names a language or
 *   asks for a translation, and anything not clear (short text, product names, mixed languages).
 */

const LANGUAGE_NAME: Record<FlowLanguage, string> = { en: "English", ms: "Malay", vi: "Vietnamese" };

/** Quotes around a phrase the merchant typed: straight, curly, guillemets. */
const QUOTED = /["“”'‘’«»]([^"“”'‘’«»]{4,200})["“”'‘’«»]/gu;

const squash = (text: string) => text.normalize("NFC").replace(/<[^>]*>/g, " ").replace(/[\s"“”'‘’«»]+/gu, " ").trim().toLowerCase();

/** The new text is the merchant's own: their message holds it whole, or holds a quoted phrase the text contains. */
function isMerchantsWording(after: string, request: string): boolean {
	const text = squash(after);
	const said = squash(request);
	if (text.length > 0 && said.includes(text)) return true;
	for (const match of request.matchAll(QUOTED)) {
		const phrase = squash(match[1] ?? "");
		if (phrase.split(" ").length >= 2 && text.includes(phrase)) return true;
	}
	return false;
}

/** en / ms / vi from the editor's language code ("en", "ms-MY"), or null. */
function pageLanguage(code: string | undefined): FlowLanguage | null {
	const base = code?.trim().toLowerCase().split("-")[0];
	return base === "en" || base === "ms" || base === "vi" ? base : null;
}

export interface TextLanguageDiff {
	field: string;
	path?: string;
	before: string | null;
	after: string;
	entity: { label?: string };
}

export interface LanguageSwitch {
	where: string;
	/** the language the page text is in */
	expected: FlowLanguage;
	/** the language the new text is in */
	got: FlowLanguage;
	after: string;
}

/** The drafted diffs whose new text is clearly in another language than the text it replaces (see the header). */
export function languageSwitches(diffs: readonly TextLanguageDiff[], request: string, editorLanguage: string | undefined): LanguageSwitch[] {
	if (LANGUAGE_REQUESTED.test(request)) return [];
	const fallback = pageLanguage(editorLanguage);
	const found: LanguageSwitch[] = [];
	for (const diff of diffs) {
		// only text that replaces text: a new section has nothing to keep the language of
		if (diff.before === null || diff.before.trim() === "") continue;
		const got = confidentLanguage(diff.after);
		if (got === null) continue;
		const expected = confidentLanguage(diff.before) ?? fallback;
		if (expected === null || expected === got) continue;
		if (isMerchantsWording(diff.after, request)) continue;
		found.push({ where: `${diff.entity.label ?? "section"} → ${diff.path ?? diff.field}`, expected, got, after: diff.after });
	}
	return found;
}

/** What the model is told when it wrote page text in the wrong language. */
export function languageSwitchRefusal(switches: readonly LanguageSwitch[]): { error: { code: string; message: string } } {
	const lines = switches.slice(0, 4).map((s) => `${s.where}: new text is ${LANGUAGE_NAME[s.got]}, the page is ${LANGUAGE_NAME[s.expected]}`);
	const expected = LANGUAGE_NAME[switches[0]?.expected ?? "en"];
	return {
		error: {
			code: "wrong_language",
			message: `Nothing was staged. The new text is not in the language of the page text it replaces (${lines.join("; ")}). Website text keeps its language, whatever language the chat is in: rewrite the new text in ${expected} and stage it again. Only when the merchant asked for another language, or typed this exact text, send the same change again.`,
		},
	};
}

/** The card's note when the same text is sent again after the refusal (the merchant may have wanted that language). */
export function languageSwitchGuardrails(switches: readonly LanguageSwitch[]) {
	return switches.slice(0, 4).map((s) => ({ rule: "text_language", ok: false, detail: `${s.where}: written in ${LANGUAGE_NAME[s.got]}, the page text is ${LANGUAGE_NAME[s.expected]}.` }));
}
