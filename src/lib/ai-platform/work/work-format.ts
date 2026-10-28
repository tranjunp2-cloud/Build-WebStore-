import { createHash } from "node:crypto";

/**
 * Small pure formatters shared by the work queue's wording: ages, money,
 * name lists, length clipping and fingerprints. No I/O.
 */

export type WorkLocale = "en" | "ms" | "vi";

export const WORK_LOCALES: readonly WorkLocale[] = ["en", "ms", "vi"];

export const isWorkLocale = (value: unknown): value is WorkLocale =>
	typeof value === "string" && (WORK_LOCALES as readonly string[]).includes(value);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const AGE_UNITS: Record<WorkLocale, { min: string; hour: string; days: (n: number) => string }> = {
	en: { min: "min", hour: "h", days: (n) => (n === 1 ? "1 day" : `${n} days`) },
	ms: { min: "minit", hour: "jam", days: (n) => `${n} hari` },
	vi: { min: "phút", hour: "giờ", days: (n) => `${n} ngày` },
};

/** "40 min", "3 h", "2 days" — how long something has waited. */
export function formatAge(ms: number, locale: WorkLocale): string {
	const units = AGE_UNITS[locale];
	const safe = Math.max(0, ms);
	if (safe < HOUR) return `${Math.max(1, Math.floor(safe / MINUTE))} ${units.min}`;
	if (safe < 48 * HOUR) return `${Math.floor(safe / HOUR)} ${units.hour}`;
	return units.days(Math.floor(safe / (24 * HOUR)));
}

const CURRENCY_SYMBOL: Record<string, string> = { MYR: "RM", SGD: "S$", USD: "US$", VND: "₫" };

/** "RM 86.00" */
export function formatMoney(amount: number, currency: string): string {
	const symbol = CURRENCY_SYMBOL[currency.toUpperCase()] ?? currency.toUpperCase();
	const value = Number.isFinite(amount) ? amount : 0;
	return `${symbol} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const AND_MORE: Record<WorkLocale, (rest: number) => string> = {
	en: (rest) => `and ${rest} more`,
	ms: (rest) => `dan ${rest} lagi`,
	vi: (rest) => `và ${rest} sản phẩm khác`,
};

/** "Kopi O, Teh Tarik and 3 more" — the first names of a set of `total` things. */
export function nameList(names: readonly string[], total: number, locale: WorkLocale, show = 2): string {
	const shown = names.filter((name) => name.trim().length > 0).slice(0, show);
	if (shown.length === 0) return "";
	const rest = Math.max(0, total - shown.length);
	return rest > 0 ? `${shown.join(", ")} ${AND_MORE[locale](rest)}` : shown.join(", ");
}

/** Cut to `max` characters with an ellipsis, so templated text always fits the contract. */
export function clip(text: string, max: number): string {
	const clean = text.replace(/\s+/g, " ").trim();
	return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Changes when the set behind an item changes (a new order arrives, a product sells out). */
export function fingerprintOf(ids: readonly string[], count: number): string {
	const digest = createHash("sha256").update([...ids].sort().join("|")).digest("hex").slice(0, 20);
	return `${count}:${digest}`;
}
