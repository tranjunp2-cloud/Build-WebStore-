import { type WorkItem, WorkItemSchema } from "@ech/agent-core";
import type { Payload } from "payload";
import { firstUsableSite } from "@/lib/insights/shop-todo";
import type { ReportsDb } from "@/lib/reports/report-db";
import { evaluateAuthoritativeLocalSeo } from "@/lib/seo/local-seo-evaluation";
import type { SeoHealthIssueCode } from "@/lib/seo/local-seo-score-contract";
import { clip, fingerprintOf, type WorkLocale } from "./work-format";

/**
 * The dashboard's SEO health as one issue: how many SEO issues the website has and its search
 * score. The assistant reads the same evaluation (site check) and fixes what it can — page
 * content, search titles and descriptions; business details (address, phone, opening hours…)
 * are the merchant's to fill in, and the assistant says where.
 */

type Lang = "en" | "ms";
const lang = (locale: WorkLocale): Lang => (locale === "ms" ? "ms" : "en");

const NAMES: Record<SeoHealthIssueCode, Record<Lang, string>> = {
	"store-name": { en: "shop name", ms: "nama kedai" },
	"business-address": { en: "business address", ms: "alamat perniagaan" },
	phone: { en: "phone number", ms: "nombor telefon" },
	"schema-subtype": { en: "business type", ms: "jenis perniagaan" },
	"opening-hours": { en: "opening hours", ms: "waktu buka" },
	"map-location": { en: "map location", ms: "lokasi peta" },
	"price-range": { en: "price range", ms: "julat harga" },
	"primary-domain": { en: "domain", ms: "domain" },
	"store-unpublished": { en: "website not published", ms: "laman web belum diterbit" },
	"meta-title": { en: "search titles", ms: "tajuk carian" },
	"meta-description": { en: "search descriptions", ms: "keterangan carian" },
	"content-quality": { en: "page content", ms: "kandungan halaman" },
	"image-alt": { en: "picture descriptions", ms: "keterangan gambar" },
	"search-verification": { en: "search verification", ms: "pengesahan carian" },
};

const COPY = {
	en: {
		title: (n: number) => (n === 1 ? "1 SEO issue on your website" : `${n} SEO issues on your website`),
		fact: (score: number) => `search score ${score} / 100`,
		say: (n: number, names: string) =>
			`Your website has ${n === 1 ? "1 SEO issue" : `${n} SEO issues`} (${names}), so search engines show it lower. I can fix the page content and search texts, and tell you which details to fill in. Start?`,
		go: "Fix with AI",
		open: "Open settings",
		area: "Website",
		task: "Fix SEO issues",
		prompt:
			"Check my website's SEO issues. Fix what you can (page content, search titles and descriptions) and tell me which business details I need to fill in myself, and where.",
	},
	ms: {
		title: (n: number) => `${n} isu SEO di laman web anda`,
		fact: (score: number) => `skor carian ${score} / 100`,
		say: (n: number, names: string) =>
			`Laman web anda ada ${n} isu SEO (${names}), jadi enjin carian memaparkannya lebih rendah. Saya boleh betulkan kandungan halaman dan teks carian, dan beritahu butiran yang perlu anda isi. Mula?`,
		go: "Betulkan dengan AI",
		open: "Buka tetapan",
		area: "Laman web",
		task: "Betulkan isu SEO",
		prompt:
			"Semak isu SEO laman web saya. Betulkan apa yang boleh (kandungan halaman, tajuk dan keterangan carian) dan beritahu butiran perniagaan yang perlu saya isi sendiri, dan di mana.",
	},
} as const;

/** One item for the website's SEO issues, or none (no website, no issues, the evaluation failed). */
export async function seoWorkItem(payload: Payload, tenantId: string, siteId: string | null, locale: WorkLocale): Promise<WorkItem | null> {
	const site = siteId ?? (await firstUsableSite(payload as unknown as ReportsDb, Number(tenantId)));
	if (!site) return null;
	const { response } = await evaluateAuthoritativeLocalSeo(payload as never, String(site), tenantId);
	const issues = response.issues;
	if (issues.length === 0) return null;
	const l = lang(locale);
	const copy = COPY[l];
	const names = issues.slice(0, 3).map((issue) => NAMES[issue.code][l]);
	const shown = issues.length > 3 ? `${names.join(", ")} +${issues.length - 3}` : names.join(", ");
	const built: WorkItem = {
		key: "shop:seo_issues",
		source: "shop",
		kind: "seo_issues",
		group: "week",
		order: 900,
		count: issues.length,
		title: clip(copy.title(issues.length), 160),
		detail: clip(shown.charAt(0).toUpperCase() + shown.slice(1), 200),
		// below 50 the dashboard calls it "at risk": red; otherwise amber
		fact: { text: copy.fact(response.score), tone: response.score < 50 ? "late" : "near" },
		area: copy.area,
		icon: "search",
		say: clip(copy.say(issues.length, shown), 400),
		short: clip(copy.title(issues.length), 120),
		actions: [
			{ kind: "prompt", value: copy.prompt, label: copy.go },
			{ kind: "link", value: `/editor/${encodeURIComponent(String(site))}?settingsTab=global`, label: copy.open },
		],
		href: `/editor/${encodeURIComponent(String(site))}?settingsTab=global`,
		taskKey: "shop:seo_issues",
		taskTitle: copy.task,
		fingerprint: fingerprintOf(issues.map((issue) => issue.code), issues.length),
	};
	const parsed = WorkItemSchema.safeParse(built);
	return parsed.success ? parsed.data : null;
}
