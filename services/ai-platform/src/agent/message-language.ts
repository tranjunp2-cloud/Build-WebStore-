import { type FlowLanguage, flowLanguage } from "./ask/flow-copy";

/** Vietnamese letters English and Malay never use. */
const VIETNAMESE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu;
/** Frequent Malay words (not English ones), whole words only. */
const MALAY =
	/(?<![\p{L}])(saya|kami|anda|awak|untuk|dan|yang|ini|itu|boleh|tolong|apa|berapa|jualan|produk|pesanan|hari ini|minggu|bulan|kedai|tunjuk(?:kan)?|buat|tulis|dengan|tidak|ada|sudah|belum|mana|bagaimana|kenapa|baru|semua|perlu)(?![\p{L}])/giu;

/**
 * The language a merchant wrote a message in (en / ms / vi), for text the platform writes without a
 * model (suggestions, shortcut answers). Vietnamese by its letters, Malay by two or more frequent
 * words; a message too short to tell goes by the UI locale.
 */
export function messageLanguage(text: string, uiLocale?: string): FlowLanguage {
	if (VIETNAMESE.test(text)) return "vi";
	const malay = text.match(MALAY)?.length ?? 0;
	if (malay >= 2 || (malay === 1 && text.trim().split(/\s+/).length <= 3)) return "ms";
	const words = text.trim().split(/\s+/).filter(Boolean).length;
	if (words >= 3) return "en";
	return flowLanguage(null, uiLocale);
}

/** The writing systems a reply can be told apart by (letters only: digits, punctuation and emoji don't count). */
export type MessageScript = "latin" | "cyrillic" | "cjk" | "arabic" | "thai" | "hangul" | "other";

const SCRIPTS: ReadonlyArray<[MessageScript, RegExp]> = [
	["latin", /\p{Script=Latin}/u],
	["cyrillic", /\p{Script=Cyrillic}/u],
	["cjk", /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u],
	["arabic", /\p{Script=Arabic}/u],
	["thai", /\p{Script=Thai}/u],
	["hangul", /\p{Script=Hangul}/u],
];

/** The script most of the text's letters are in, or null when it has too few letters to tell. */
export function messageScript(text: string, minLetters = 3): MessageScript | null {
	const counts = new Map<MessageScript, number>();
	let letters = 0;
	for (const char of text.normalize("NFC")) {
		if (!/\p{L}/u.test(char)) continue;
		letters += 1;
		const script = SCRIPTS.find(([, pattern]) => pattern.test(char))?.[0] ?? "other";
		counts.set(script, (counts.get(script) ?? 0) + 1);
	}
	if (letters < minLetters) return null;
	return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const SCRIPT_LABEL: Record<Exclude<MessageScript, "latin">, string> = {
	cyrillic: "Cyrillic",
	cjk: "Chinese/Japanese",
	arabic: "Arabic",
	thai: "Thai",
	hangul: "Korean",
	other: "non-Latin",
};

/** Common English words: a Latin-script message is called English only when it uses some (Spanish or Indonesian also lack Malay/Vietnamese markers). */
const ENGLISH =
	/(?<![\p{L}])(the|a|an|to|my|me|and|for|of|in|on|is|are|add|show|make|change|update|please|this|that|with|it|you|can|do|what|how|i|write|create|remove|delete|set|from|all|new|page|product|products)(?![\p{L}])/giu;

/** English words other languages written in Latin letters (Spanish, French, Indonesian…) do not use: one is enough from 3 words on. */
const STRONG_ENGLISH =
	/(?<![\p{L}])(the|my|your|our|with|what|this|that|from|make|write)(?![\p{L}])/iu;

/**
 * The language to answer a message in, when it can be told for sure: "English" / "Malay" / "Vietnamese" for a
 * message of three or more words, "the language of this message (Cyrillic script)" for other scripts.
 * null = too short or not clear: the model goes by the message itself.
 */
export function replyLanguageName(text: string): string | null {
	const words = text.trim().split(/\s+/).filter(Boolean).length;
	if (words < 3) return null;
	const script = messageScript(text);
	if (script === null) return null;
	if (script !== "latin") return `the language of this message (${SCRIPT_LABEL[script]} script)`;
	const language = messageLanguage(text);
	if (language === "vi") return "Vietnamese";
	if (language === "ms") return "Malay";
	// two common English words, or one that no other Latin-script language shares ("Make hero shorter")
	return (text.match(ENGLISH)?.length ?? 0) >= 2 || STRONG_ENGLISH.test(text) ? "English" : null;
}

const NEUTRAL_SUMMARY: Record<FlowLanguage, string> = {
	en: "Review the changes below before approving.",
	ms: "Semak perubahan di bawah sebelum meluluskan.",
	vi: "Xem lại các thay đổi bên dưới trước khi duyệt.",
};

/**
 * More Malay words that card summaries and page copy use ("tanpa mengubah harga atau halaman lain", "dihantar ke
 * seluruh Malaysia") but a merchant's chat message rarely does. Only `confidentLanguage` counts them: the message
 * detectors above stay as they were.
 */
const MALAY_COPY =
	/(?<![\p{L}])(ke|di|dari|atau|tanpa|harga|halaman|seperti|sahaja|hanya|juga|akan|telah|lebih|sangat|kepada|pada|oleh|serta|seluruh|setiap|dalam|bagi|jika|kerana|supaya|dapat|mahu|tetapi|sekarang|percuma|dihantar|hantar|tempah|beli|lihat|menukar|mengubah|menambah|memendekkan|tajuk|bahagian|penjagaan|kulit|harian|lembut|pilihan|penerangan|diminta|disentuh|tindakan|utama)(?![\p{L}])/giu;

/**
 * The language of a Latin-script text when it can be told with confidence, else null: Vietnamese by its
 * letters, Malay by two or more frequent Malay words, English by two or more common English words and no
 * Malay one. Shorter or mixed text is "not sure" (null), so a guard built on it never fires on a guess.
 */
export function confidentLanguage(text: string): FlowLanguage | null {
	if (VIETNAMESE.test(text)) return "vi";
	const malay = (text.match(MALAY)?.length ?? 0) + (text.match(MALAY_COPY)?.length ?? 0);
	const english = text.match(ENGLISH)?.length ?? 0;
	if (malay >= 2 && malay > english) return "ms";
	if (malay === 0 && english >= 2) return "en";
	return null;
}

/** The reply language of a message of three or more words that is clearly en / ms / vi; null when unknown. */
function knownReplyLanguage(prompt: string): FlowLanguage | null {
	const name = replyLanguageName(prompt);
	if (name === "English") return "en";
	if (name === "Malay") return "ms";
	if (name === "Vietnamese") return "vi";
	return null;
}

/**
 * A card's one-line summary is written by the model, and two things can put it in another language than the
 * merchant's message:
 * - another script (Cyrillic under an English request): replaced by a platform line in the merchant's language
 *   (`title` when that language is not one the platform has lines for);
 * - the same script but another language (a Malay summary after an English request, because the chat's earlier
 *   turns were Malay): when the message is clearly en / ms / vi and the summary is clearly another of them,
 *   it is replaced by the platform line in the message's language.
 * Anything not clear is left alone.
 */
export function summaryInScriptOf(summary: string, title: string, prompt: string): string {
	const wanted = messageScript(prompt);
	const got = messageScript(summary);
	if (wanted === null || got === null) return summary;
	if (wanted !== got) return wanted !== "latin" ? title : NEUTRAL_SUMMARY[messageLanguage(prompt)];
	if (wanted !== "latin") return summary;
	const promptLanguage = knownReplyLanguage(prompt);
	const summaryLanguage = confidentLanguage(summary);
	if (promptLanguage !== null && summaryLanguage !== null && promptLanguage !== summaryLanguage) return NEUTRAL_SUMMARY[promptLanguage];
	return summary;
}

/** The merchant asks for a language or a translation: whatever language the text (or the reply) comes out in is then asked for. */
export const LANGUAGE_REQUESTED = /\b(translat\w*|terjemah\w*|english|inggeris|malay|melayu|bahasa|vietnam\w*|chinese|mandarin|tamil|arabic)\b|dịch|tiếng/iu;

/** Starts the platform's closing line of a user turn; the part of the turn after it is not the merchant's words (tool routing skips it). */
export const PLATFORM_NOTE_PREFIX = "[Platform note, not from the merchant:";

/** The line closing the merchant's turn: the model weighs the end of the latest user message most, and an earlier Malay turn must not win. */
export function replyLanguageNote(language: string | null): string | null {
	if (!language) return null;
	const named = language.includes("this message");
	return `${PLATFORM_NOTE_PREFIX} write your reply, questions and card notes in ${named ? language : `${language}, the language of the message above`}, even if earlier messages in this chat were in another language, unless the merchant asks for another language for the reply. Website text keeps the page's language.]`;
}

const REPLY_LANGUAGE: Record<string, FlowLanguage> = { English: "en", Malay: "ms", Vietnamese: "vi" };
const LANGUAGE_NAME: Record<FlowLanguage, string> = { en: "English", ms: "Malay", vi: "Vietnamese" };
const VIETNAMESE_LETTERS = new RegExp(VIETNAMESE.source, "giu");

/** The language of a finished reply when it is clear: like `confidentLanguage`, but a Vietnamese name quoted in an English reply is not Vietnamese. */
function languageOfReply(reply: string): FlowLanguage | null {
	const english = reply.match(ENGLISH)?.length ?? 0;
	const vietnamese = reply.match(VIETNAMESE_LETTERS)?.length ?? 0;
	if (vietnamese >= 4 && english < 3) return "vi";
	if (vietnamese > 0) return null;
	return confidentLanguage(reply);
}

/**
 * The language the reply to this message must be in when the reply is clearly in another one, else null. Only when
 * the message is clearly English / Malay / Vietnamese (or, for another script, the reply is clearly in Latin letters)
 * and the reply is clearly another of them; a request that names a language or a translation is never judged,
 * and anything short or mixed is left alone.
 */
export function wrongReplyLanguage(prompt: string, reply: string): string | null {
	if (LANGUAGE_REQUESTED.test(prompt)) return null;
	const wanted = replyLanguageName(prompt);
	if (wanted === null) return null;
	if (wanted.includes("this message")) {
		return messageScript(reply, 20) === "latin" ? wanted : null;
	}
	const required = REPLY_LANGUAGE[wanted];
	const got = languageOfReply(reply);
	return required !== undefined && got !== null && got !== required ? LANGUAGE_NAME[required] : null;
}
