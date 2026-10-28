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
