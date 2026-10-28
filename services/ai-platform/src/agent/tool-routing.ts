import type { LanguageModel, LanguageModelMiddleware, ToolSet } from "ai";
import { tool, wrapLanguageModel } from "ai";
import { z } from "zod";
import type { Capability } from "../config/capabilities";
import { type CapabilitySet, capabilityKey, capabilitySet, TOOL_CAPABILITIES, toolAllowed, type MerchantToolName } from "./merchant-capabilities";

/**
 * Tool routing (cost): a request sends the model only the tool groups it needs, not the deployment's
 * whole tool surface (≈106 k characters of instructions + schemas with the full staging set). A group is a
 * set of capabilities, so a routed request is just a smaller capability set: its instructions
 * (`merchantInstructions(set, full)`) and tool schemas are the ones that set always renders — static
 * bytes per set, so each variant keeps its own prompt-cache prefix. Groups come from the page the
 * message was sent from, the record it is about, a cheap keyword match on the message and the chat's
 * last turn (en / ms / vi). `use_tools` loads more groups for the next step when the model needs them,
 * and a call to a tool that was not sent loads that tool's group too. Routing never widens what the
 * deployment allows: every group is cut to the effective capability set, and `AI_TOOL_ROUTING=off`
 * sends the whole set exactly as before.
 */

export const TOOL_GROUPS = [
	"website",
	"blog",
	"products",
	"inventory",
	"categories",
	"discounts",
	"orders",
	"customers",
	"reports",
	"campaigns",
	"pictures",
] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

export const USE_TOOLS = "use_tools";

/** The capabilities each group is about (the group exists where one of them is on). */
const GROUP_CAPABILITIES: Record<ToolGroup, readonly Capability[]> = {
	website: ["site"],
	blog: ["blog"],
	products: ["product_master", "store_products", "shop_products"],
	inventory: ["inventory"],
	categories: ["store_categories"],
	discounts: ["store_discounts"],
	orders: ["store_orders"],
	customers: ["store_customers"],
	reports: ["store_reports"],
	campaigns: ["campaigns"],
	pictures: ["stock_photos", "media_library", "image_generation"],
};

/** Groups that come with a group (start_campaign stages a code, a homepage banner and maybe a post). */
const GROUP_COMPANIONS: Partial<Record<ToolGroup, readonly ToolGroup[]>> = {
	campaigns: ["discounts", "website", "blog"],
};

/** What use_tools says each group is for (only groups the deployment has are listed). */
const GROUP_PURPOSE: Record<ToolGroup, string> = {
	website: "the website: pages, sections, text, pictures, menu, footer, theme, SEO, languages, publishing",
	blog: "blog posts: read, write, edit, publish, trash",
	products: "the shop's products: find, read, draft, edit, archive",
	inventory: "stock: levels, warehouses, transfers, counts, adjustments",
	categories: "the store's product categories",
	discounts: "discount codes: list, create, change, pause, delete",
	orders: "orders: what needs action, confirm, ship, payment proofs, cancel, refund",
	customers: "customers, contact-form leads (and replying to them), email templates",
	reports: "sales, best sellers, discount performance, traffic, and the to-do list of what needs attention",
	campaigns: "a promotion: a discount code with a homepage banner and an announcement post",
	pictures: "photos: stock, the shop's library, generated pictures",
};

/** What the deployment's groups do, one line each (the tiny suggestion call's "can do" list). */
export function groupPurposes(full: CapabilitySet): string[] {
	return availableGroups(full).map((group) => GROUP_PURPOSE[group]);
}

/** Content groups place pictures: the photo tools come with them. */
const WITH_PICTURES: ReadonlySet<ToolGroup> = new Set(["website", "blog", "products", "campaigns"]);

/** The page module word (first path segment) → groups. */
const MODULE_GROUPS: Record<string, readonly ToolGroup[]> = {
	editor: ["website"],
	sites: ["website"],
	blog: ["blog"],
	products: ["products"],
	store: ["products", "categories"],
	categories: ["categories"],
	inventory: ["inventory", "products"],
	orders: ["orders"],
	customers: ["customers"],
	"contact-leads": ["customers"],
	leads: ["customers"],
	discounts: ["discounts"],
	media: ["pictures"],
	dashboard: ["reports"],
	reports: ["reports"],
	settings: ["customers"],
};

/** A to-do item's kind (the task chat's key starts with it) → groups. */
const TODO_GROUPS: ReadonlyArray<[RegExp, readonly ToolGroup[]]> = [
	[/^(orders_|payment_)/, ["orders"]],
	[/^(out_of_stock|low_stock)/, ["products", "inventory"]],
	[/^products_/, ["products"]],
	[/^discounts_/, ["discounts"]],
	[/^leads_/, ["customers"]],
	[/^site_/, ["website"]],
];

// Word starts/ends that work for Vietnamese and Malay letters too (\b is ASCII-only).
const W = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "iu");

/** Cheap keyword match per group, English / Malay / Vietnamese. Over-matching only costs a few schemas. */
const KEYWORDS: Record<ToolGroup, RegExp> = {
	website: W(
		"websites?|web ?site|site|pages?|home ?page|landing|sections?|banners?|hero|menu|footer|header|navigation|nav|theme|colou?rs?|fonts?|publish(?:ed|ing)?|go live|seo|slug|links?|buttons?|translat\\w*|languages?|laman web|laman|halaman|tapak|tema|warna|terbit(?:kan)?|butang|pautan|trang web|trang chủ|trang|giao diện|màu|phông chữ|chân trang|đầu trang|nút|liên kết|xuất bản|ngôn ngữ|dịch(?! vụ)|tiêu đề",
	),
	blog: W("blogs?|posts?|articles?|artikel|catatan|bài viết|bài đăng|bài blog"),
	products: W(
		"products?|items?|skus?|catalog(?:ue)?|variants?|prices?|listings?|produk|barang|harga|varian|sản phẩm|mặt hàng|hàng hóa|giá|biến thể",
	),
	inventory: W("stocks?|inventory|warehouses?|restock|stok|inventori|gudang|tồn kho|kho|nhập hàng"),
	categories: W("categor(?:y|ies)|collections?|kategori|danh mục"),
	discounts: W(
		"discounts?|coupons?|vouchers?|promo(?:tion)? ?codes?|codes?|% ?off|diskaun|kupon|baucar|kod|giảm giá|mã giảm|mã|khuyến mãi|voucher",
	),
	orders: W(
		"orders?|ship(?:ping|ped)?|deliver(?:y|ies)|tracking|refunds?|cancel(?:led)?|payments?|proofs?|transfers?|pesanan|tempahan|penghantaran|bayaran|pembayaran|bayaran balik|đơn hàng|đơn(?! giản)(?! vị)|giao hàng|vận chuyển|hoàn tiền|hủy|huỷ|thanh toán|chuyển khoản",
	),
	customers: W(
		"customers?|buyers?|clients?|leads?|contacts?|messages?|enquir(?:y|ies)|inquir(?:y|ies)|emails?|e-mails?|templates?|repl(?:y|ies)|pelanggan|pembeli|mesej|e-mel|balas|khách hàng|khách|liên hệ|tin nhắn|trả lời|mẫu email",
	),
	reports: W(
		"sales|sold|revenue|reports?|best ?sellers?|top|traffic|visitors?|views|how many|how much|today|this week|this month|last month|to ?do|attention|missing|performance|insights?|numbers|jualan|hasil|laporan|pelawat|hari ini|minggu ini|bulan ini|berapa|doanh thu|doanh số|báo cáo|bán chạy|lượt truy cập|hôm nay|tuần này|tháng này|bao nhiêu|cần làm|việc cần",
	),
	campaigns: W("campaigns?|promotions?|flash sale|weekend sale|\\d{1,2}\\.\\d{1,2} sale|kempen|chiến dịch|chạy khuyến mãi"),
	pictures: W(
		"photos?|pictures?|images?|pics?|cover|thumbnails?|generate|gallery|gambar|foto|imej|ảnh|hình|hình ảnh|tạo ảnh",
	),
};

/** Which groups a text mentions (prompt, the chat's last turn). */
export function groupsInText(text: string): ToolGroup[] {
	const clean = text.normalize("NFC").slice(0, 4_000);
	return TOOL_GROUPS.filter((group) => KEYWORDS[group].test(clean));
}

/**
 * Groups one user turn asks for: its Context head (the page's module, the record it is viewing or the
 * chat was started on, Ask AI picks, attached files) and the words of the merchant's request. The head
 * is never keyword-matched ("Today is …" would load the reports everywhere).
 */
export function groupsInUserTurn(turn: string): Set<ToolGroup> {
	const groups = new Set<ToolGroup>();
	const cut = turn.indexOf("\n\n");
	const head = cut >= 0 && turn.startsWith("Context:") ? turn.slice(0, cut) : "";
	const request = cut >= 0 && head ? turn.slice(cut + 2) : turn;
	const module = /module "([^"]{1,40})"/.exec(head)?.[1] ?? /^Context: the merchant is on the "([^"]{1,40})" page/.exec(head)?.[1];
	for (const group of MODULE_GROUPS[module ?? ""] ?? []) groups.add(group);
	if (/(?:viewing|started on|Picked in the chat[^\n]*?) (?:blog post|post)\b/.test(head)) groups.add("blog");
	if (/(?:viewing|started on|Picked in the chat[^\n]*?) product\b/.test(head)) groups.add("products");
	if (/^Selected on the page/m.test(head)) groups.add("website");
	if (/^Attached: .*\(image:/m.test(head)) groups.add("pictures");
	// a sheet or a PDF sent to the copilot is mostly a product list
	if (/^Attached: .*\(document:/m.test(head)) groups.add("products");
	for (const group of groupsInText(request)) groups.add(group);
	return groups;
}

export interface RouteInput {
	/**
	 * The chat's user turns as sent (earlier ones from history, then this one): routing is the union of
	 * all of them, so a chat's tool set only grows and its history prefix keeps hitting the cache.
	 */
	turns: readonly string[];
	/** the chat's earlier replies: only their "[Staged draft …]" lines are read */
	replies?: readonly string[];
	/** the To do task this chat was started from */
	taskKey?: string | null;
}

/** Groups a message needs, before any model call. Empty = only the core tools (+ use_tools). */
export function routeGroups(input: RouteInput): ToolGroup[] {
	const groups = new Set<ToolGroup>();
	for (const turn of input.turns) for (const group of groupsInUserTurn(turn)) groups.add(group);
	for (const reply of input.replies ?? []) {
		for (const line of reply.split("\n")) if (line.startsWith("[Staged draft ")) for (const group of groupsInText(line)) groups.add(group);
	}
	for (const [pattern, keyed] of TODO_GROUPS) if (input.taskKey && pattern.test(input.taskKey)) for (const group of keyed) groups.add(group);
	return TOOL_GROUPS.filter((group) => groups.has(group));
}

/** The groups the deployment's set can load (a group none of whose capabilities is on is left out). */
export function availableGroups(full: CapabilitySet): ToolGroup[] {
	return TOOL_GROUPS.filter((group) => GROUP_CAPABILITIES[group].some((capability) => full.has(capability)));
}

/**
 * The capability set a list of groups loads, inside the deployment's set. Pictures come with the content
 * groups; a capability whose requirement is missing is dropped (capabilitySet), never added.
 */
export function routedCapabilities(groups: readonly ToolGroup[], full: CapabilitySet): CapabilitySet {
	const wanted = new Set<ToolGroup>(groups.flatMap((group) => [group, ...(GROUP_COMPANIONS[group] ?? [])]));
	if ([...wanted].some((group) => WITH_PICTURES.has(group))) wanted.add("pictures");
	const caps = [...wanted].flatMap((group) => GROUP_CAPABILITIES[group]).filter((capability) => full.has(capability));
	// a capability whose requirement is not loaded is dropped (store_products without product_master)
	const set = capabilitySet(caps);
	return capabilityKey(set) === capabilityKey(full) ? full : set;
}

/** Groups that unlock a tool (a call to a tool that was not sent loads them). */
export function groupsForTool(name: string, full: CapabilitySet): ToolGroup[] {
	const needed = TOOL_CAPABILITIES[name as MerchantToolName] as readonly Capability[] | null | undefined;
	if (!needed) return [];
	return availableGroups(full).filter((group) => GROUP_CAPABILITIES[group].some((capability) => needed.includes(capability) && full.has(capability)));
}

/** The routing state of one run (kept in the run state, so it survives an ask_user pause). */
export interface RoutingState {
	groups: ToolGroup[];
}

/** One run's router: the loaded set, what the next step sends, and loading more. */
export class ToolRouter {
	private readonly available: ToolGroup[];

	constructor(
		private readonly full: CapabilitySet,
		private readonly state: RoutingState,
	) {
		this.available = availableGroups(full);
		this.state.groups = this.state.groups.filter((group) => this.available.includes(group));
	}

	get groups(): readonly ToolGroup[] {
		return this.state.groups;
	}

	/** The capabilities loaded now. */
	get capabilities(): CapabilitySet {
		return routedCapabilities(this.state.groups, this.full);
	}

	/** Everything the deployment allows is loaded: requests look exactly like unrouted ones. */
	get complete(): boolean {
		return this.capabilities === this.full;
	}

	/** Adds groups (unknown or unavailable ones are ignored); true when the loaded set changed. */
	load(groups: readonly string[]): ToolGroup[] {
		const before = capabilityKey(this.capabilities);
		const added = groups.filter((group): group is ToolGroup => this.available.includes(group as ToolGroup) && !this.state.groups.includes(group as ToolGroup));
		if (added.length === 0) return [];
		this.state.groups = TOOL_GROUPS.filter((group) => this.state.groups.includes(group) || added.includes(group));
		return capabilityKey(this.capabilities) === before ? [] : added;
	}

	/** A tool the model called that the step did not send: load its group(s). */
	loadForTool(name: string): ToolGroup[] {
		if (name === USE_TOOLS || toolAllowed(name as MerchantToolName, this.capabilities)) return [];
		return this.load(groupsForTool(name, this.full));
	}

	/** Names of the tools the next request sends, in the tool map's fixed order. */
	sentTools(allNames: readonly string[]): Set<string> {
		const caps = this.capabilities;
		const names = allNames.filter((name) => (name === USE_TOOLS ? !this.complete : name in TOOL_CAPABILITIES && toolAllowed(name as MerchantToolName, caps)));
		return new Set(names);
	}

	/** Groups use_tools can still load. */
	get loadable(): ToolGroup[] {
		const caps = this.capabilities;
		return this.available.filter((group) => GROUP_CAPABILITIES[group].some((capability) => this.full.has(capability) && !caps.has(capability)));
	}
}

/**
 * `use_tools`: loads more groups for the next step. Its schema and description depend only on the
 * deployment's set (static bytes per set); it is sent while something is left to load.
 */
export function useToolsTool(full: CapabilitySet, load: (groups: string[]) => ToolGroup[]): ToolSet[string] {
	const groups = availableGroups(full);
	const names = (groups.length > 0 ? groups : ["reports"]) as [ToolGroup, ...ToolGroup[]];
	return tool({
		description: `Load more of your tools for this request (only the tools for the request's topic are loaded at first). Groups: ${groups.map((group) => `${group} = ${GROUP_PURPOSE[group]}`).join("; ")}. Call it before anything else when the request needs a group whose tools you don't have; they are available from your next step.`,
		inputSchema: z.object({ groups: z.array(z.enum(names)).min(1).max(groups.length || 1) }),
		execute: async ({ groups: wanted }: { groups: string[] }) => {
			const added = load(wanted);
			return added.length > 0
				? { loaded: added, note: "Their tools are available now: continue with the request." }
				: { loaded: [], note: "Those tools are already loaded: continue with the request." };
		},
	});
}

/**
 * Sends a provider only the tools the router loaded (the full tool map stays in the SDK, so a call to a
 * tool that was not sent still runs; the router then loads its group). Provider-agnostic: it filters the
 * call options every provider receives.
 */
export function routedModel(model: LanguageModel, sent: () => Set<string> | null): LanguageModel {
	// a gateway model id (string) can't be wrapped: it gets every tool, as unrouted
	if (typeof model === "string") return model;
	const middleware: LanguageModelMiddleware = {
		specificationVersion: "v4",
		transformParams: async ({ params }) => {
			const names = sent();
			if (!names || !params.tools) return params;
			return { ...params, tools: params.tools.filter((t) => names.has(t.name)) };
		},
	};
	return wrapLanguageModel({ model, middleware });
}

/** Kill switch: `AI_TOOL_ROUTING=off` sends every tool the deployment allows (as before routing). */
export function routingEnabled(value: string | undefined): boolean {
	return value !== "off";
}
