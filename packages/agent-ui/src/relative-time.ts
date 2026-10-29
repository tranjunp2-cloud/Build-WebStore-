const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact "last active" label for history rows: "now", "5 min. ago",
 * "yesterday", then a short date after a week. Localised by Intl.
 */
export function relativeTime(iso: string, locale?: string, now: number = Date.now()): string {
	const at = Date.parse(iso);
	if (Number.isNaN(at)) return "";
	const diff = Math.max(0, now - at);
	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
	if (diff < MINUTE) return rtf.format(0, "second");
	if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), "minute");
	if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), "hour");
	if (diff < 7 * DAY) return rtf.format(-Math.floor(diff / DAY), "day");
	const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
	return new Date(at).toLocaleDateString(locale, {
		day: "numeric",
		month: "short",
		...(sameYear ? {} : { year: "numeric" }),
	});
}
