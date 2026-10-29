import { type WorkGroup, type WorkItem, WorkItemSchema } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload } from "payload";
import { cachedTodos, todoCacheKey } from "@/lib/dashboard/todo-cache";
import { areasOf } from "@/lib/insights/area-access";
import { computeShopTodos, type ShopTodoItem, type ShopTodoKind } from "@/lib/insights/shop-todo";
import type { AgentActor } from "../context";
import { seoWorkItem } from "./seo-work-item";
import type { ShopWork } from "./work-cache";
import { clip, fingerprintOf, formatAge, type WorkLocale } from "./work-format";

/**
 * The shop's part of the work queue on the release (Payload): the dashboard's To do list
 * (`computeShopTodos`, same cache as the card) worded as work items. Every "now" item says
 * why it is urgent in a red fact; due-soon items get an amber one; the rest none.
 * The To do text exists in en / ms: a vi merchant gets the en titles (the UI has no vi).
 */

type Extra = {
	group: WorkGroup;
	area: "orders" | "products" | "discounts" | "website" | "leads";
	icon: string;
	/** the reason it is urgent (late) or due soon (near) */
	fact?: { tone: "late" | "near"; text: (item: ShopTodoItem, locale: WorkLocale) => string };
	ask: Record<"en" | "ms", string>;
	go: Record<"en" | "ms", string>;
};

const AREA: Record<Extra["area"], Record<"en" | "ms", string>> = {
	orders: { en: "Orders", ms: "Pesanan" },
	products: { en: "Products", ms: "Produk" },
	discounts: { en: "Discounts", ms: "Diskaun" },
	website: { en: "Website", ms: "Laman web" },
	leads: { en: "Contact leads", ms: "Petunjuk hubungan" },
};

const word = (locale: WorkLocale) => (locale === "ms" ? "ms" : "en");
const t = (en: string, ms: string) => (locale: WorkLocale) => (locale === "ms" ? ms : en);

const EXTRA: Record<ShopTodoKind, Extra> = {
	payment_proofs: {
		group: "now", area: "orders", icon: "receipt",
		fact: { tone: "late", text: (_, l) => t("buyers wait for your check", "pembeli menunggu semakan anda")(l) },
		ask: { en: "Check them now?", ms: "Semak sekarang?" }, go: { en: "Check payments", ms: "Semak bayaran" },
	},
	orders_to_confirm: {
		group: "now", area: "orders", icon: "shopping-cart",
		fact: { tone: "late", text: (item, l) => (item.ageHours != null ? `${t("oldest waiting", "paling lama menunggu")(l)} ${formatAge(item.ageHours * 3_600_000, l)}` : t("buyers wait for your reply", "pembeli menunggu balasan anda")(l)) },
		ask: { en: "Go through them now?", ms: "Semak sekarang?" }, go: { en: "Confirm orders", ms: "Sahkan pesanan" },
	},
	orders_to_ship: {
		group: "now", area: "orders", icon: "package",
		fact: { tone: "late", text: (_, l) => t("confirmed over a day ago", "disahkan lebih sehari lalu")(l) },
		ask: { en: "Get them shipped?", ms: "Hantar sekarang?" }, go: { en: "Ship orders", ms: "Hantar pesanan" },
	},
	out_of_stock: {
		group: "now", area: "products", icon: "package-x",
		fact: { tone: "late", text: (_, l) => t("buyers can't order", "pembeli tidak boleh membeli")(l) },
		ask: { en: "Restock them, or hide them for now?", ms: "Tambah stok, atau sembunyikan dahulu?" }, go: { en: "Update stock", ms: "Kemas kini stok" },
	},
	site_broken_links: {
		group: "now", area: "website", icon: "link-2-off",
		fact: { tone: "late", text: (_, l) => t("visitors see an error page", "pelawat nampak halaman ralat")(l) },
		ask: { en: "Fix them now?", ms: "Betulkan sekarang?" }, go: { en: "Fix links", ms: "Betulkan pautan" },
	},
	leads_waiting: {
		group: "week", area: "leads", icon: "user-plus",
		fact: { tone: "near", text: (_, l) => t("no reply for over 2 days", "tiada balasan lebih 2 hari")(l) },
		ask: { en: "Reply now?", ms: "Balas sekarang?" }, go: { en: "See messages", ms: "Lihat mesej" },
	},
	low_stock: {
		group: "week", area: "products", icon: "package",
		fact: { tone: "near", text: (_, l) => t("fewer than 10 left", "tinggal kurang 10")(l) },
		ask: { en: "Want the list?", ms: "Mahu senarainya?" }, go: { en: "Show the list", ms: "Tunjuk senarai" },
	},
	products_ai_review: {
		group: "week", area: "products", icon: "sparkles",
		fact: { tone: "near", text: (_, l) => t("not on sale yet", "belum dijual")(l) },
		ask: { en: "Finish setting them up?", ms: "Siapkan sekarang?" }, go: { en: "Finish your shop", ms: "Siapkan kedai anda" },
	},
	site_unpublished: {
		group: "week", area: "website", icon: "globe",
		fact: {
			tone: "near",
			text: (item, l) => (item.neverPublished ? t("visitors can't see your shop", "pelawat tidak nampak kedai anda")(l) : t("visitors see the old version", "pelawat nampak versi lama")(l)),
		},
		ask: { en: "Check what is left and publish?", ms: "Semak baki dan terbitkan?" }, go: { en: "Check and publish", ms: "Semak dan terbit" },
	},
	discounts_expiring: {
		group: "week", area: "discounts", icon: "percent",
		fact: { tone: "near", text: (_, l) => t("end within 3 days", "tamat dalam 3 hari")(l) },
		ask: { en: "Extend them, or let them end?", ms: "Lanjutkan, atau biar tamat?" }, go: { en: "Decide", ms: "Putuskan" },
	},
	discounts_used_up: {
		group: "week", area: "discounts", icon: "percent",
		fact: { tone: "near", text: (_, l) => t("still switched on", "masih aktif")(l) },
		ask: { en: "Raise the limit, or switch them off?", ms: "Naikkan had, atau matikan?" }, go: { en: "Decide", ms: "Putuskan" },
	},
	products_missing_info: {
		group: "week", area: "products", icon: "package",
		fact: { tone: "near", text: (_, l) => t("buyers see an incomplete page", "pembeli nampak halaman tidak lengkap")(l) },
		ask: { en: "Fill in what is missing?", ms: "Lengkapkan yang tiada?" }, go: { en: "Fill them in", ms: "Lengkapkan" },
	},
	site_missing_seo: {
		group: "week", area: "website", icon: "search",
		fact: { tone: "near", text: (_, l) => t("search shows a generic snippet", "carian papar ringkasan umum")(l) },
		ask: { en: "Write them now?", ms: "Tulis sekarang?" }, go: { en: "Write them", ms: "Tulis" },
	},
};

const OPEN: Record<"en" | "ms", string> = { en: "Open", ms: "Buka" };

/** kinds whose To do sentence only repeats the fact (the orders' age, "not on sale until you look", the error page…) */
const SAID_BY_FACT = new Set<ShopTodoKind>(["orders_to_confirm", "site_broken_links", "products_ai_review", "site_unpublished", "site_missing_seo"]);

/** One To do row → one work item (pure; exported for tests). */
export function shopTodoWorkItem(todo: ShopTodoItem, locale: WorkLocale, order: number): WorkItem | null {
	const extra = EXTRA[todo.kind];
	if (!extra) return null;
	const lang = word(locale);
	// the fact says it already (the orders' age, the broken link's error page): the To do's own sentence would say it twice
	const detail = SAID_BY_FACT.has(todo.kind) ? undefined : todo.detail;
	const built: WorkItem = {
		key: `shop:${todo.kind}`,
		source: "shop",
		kind: todo.kind,
		group: extra.group,
		order,
		count: todo.count,
		title: clip(todo.title, 160),
		...(detail ? { detail: clip(detail, 200) } : {}),
		...(extra.fact ? { fact: { tone: extra.fact.tone, text: clip(extra.fact.text(todo, locale), 80) } } : {}),
		area: AREA[extra.area][lang],
		icon: extra.icon,
		say: clip(`${todo.title}. ${detail ? `${detail} ` : ""}${extra.ask[lang]}`.replace(/\.\./g, "."), 400),
		short: clip(todo.title, 120),
		actions: [
			{ kind: "prompt", value: todo.prompt.slice(0, 600), label: extra.go[lang] },
			{ kind: "link", value: todo.href, label: OPEN[lang] },
		],
		href: todo.href,
		taskKey: `shop:${todo.kind}`,
		taskTitle: clip(todo.title, 120),
		fingerprint: fingerprintOf([todo.kind], todo.count),
	};
	const parsed = WorkItemSchema.safeParse(built);
	if (parsed.success) return parsed.data;
	console.warn("[shop-work] dropped an invalid work item", built.key, parsed.error.issues[0]?.message);
	return null;
}

export function shopTodoWorkItems(todos: readonly ShopTodoItem[], locale: WorkLocale): WorkItem[] {
	return todos.flatMap((todo, index) => shopTodoWorkItem(todo, locale, index * 10) ?? []);
}

/** The To do list for the user acting now (same scoping and one-minute cache as the dashboard card; `siteId` = the website checked). */
export async function loadShopWork(actor: AgentActor, locale: WorkLocale, now: Date, options: { siteId?: string | null } = {}): Promise<ShopWork> {
	const todoLocale = locale === "ms" ? "ms" : "en";
	const siteId = options.siteId ?? null;
	const areas = areasOf(actor.user, actor.tenantId);
	const key = todoCacheKey({ tenantId: actor.tenantId, siteId, locale: todoLocale, areas });
	const todos = await cachedTodos(key, async () => {
		const payload = await getPayload({ config });
		return computeShopTodos(payload, { tenantId: actor.tenantId, siteId, now, locale: todoLocale, areas });
	});
	const items = shopTodoWorkItems(todos, locale);
	// the website's SEO health: one issue, read at most every few minutes (two snapshot reads each time)
	if (areas.builder) {
		const seo = await cachedSeoItem(`${actor.tenantId}|${siteId ?? ""}|${locale}`, async () => seoWorkItem(await getPayload({ config }), actor.tenantId, siteId, locale)).catch((error) => {
			console.warn("[shop-work] SEO health unavailable", error instanceof Error ? error.message : error);
			return null;
		});
		if (seo) items.push(seo);
	}
	return { items, partial: false };
}

const SEO_TTL_MS = 5 * 60_000;
const SEO_MAX_ENTRIES = 5_000;
const seoCache = new Map<string, { at: number; value: Promise<WorkItem | null> }>();

/** One evaluation per workspace, site and language every 5 minutes; a failure is not remembered; LRU-bounded. */
function cachedSeoItem(key: string, load: () => Promise<WorkItem | null>): Promise<WorkItem | null> {
	const hit = seoCache.get(key);
	if (hit && Date.now() - hit.at < SEO_TTL_MS) {
		seoCache.delete(key);
		seoCache.set(key, hit);
		return hit.value;
	}
	const value = load();
	seoCache.set(key, { at: Date.now(), value });
	if (seoCache.size > SEO_MAX_ENTRIES) seoCache.delete(seoCache.keys().next().value as string);
	value.catch(() => seoCache.delete(key));
	return value;
}
