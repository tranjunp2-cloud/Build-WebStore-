import { CAPABILITIES, CAPABILITY_CONFLICTS, CAPABILITY_REQUIRES, type Capability, isCapability, OPT_IN_CAPABILITIES } from "../config/capabilities";

export type CapabilitySet = ReadonlySet<Capability>;

/** Every default capability: the behaviour when `AI_AGENT_CAPABILITIES` is unset (opt-in ones like shop_products are not part of it). */
export const ALL_CAPABILITIES: CapabilitySet = new Set(CAPABILITIES.filter((capability) => !OPT_IN_CAPABILITIES.includes(capability)));

/**
 * Which capability unlocks each copilot tool: the tool is offered when the set holds
 * ANY of the listed capabilities; `null` = always (it needs no shop data).
 * `createMerchantTools` builds exactly these names (a spec keeps the two in step).
 */
export const TOOL_CAPABILITIES = {
	ask_user: null,
	current_page: null,
	find_images: ["stock_photos", "media_library"],
	generate_image: ["image_generation"],
	read_item: ["blog", "product_master", "shop_products"],
	search_items: ["blog", "product_master", "shop_products"],
	propose_update: ["blog"],
	propose_status_change: ["blog", "product_master"],
	propose_product_drafts: ["product_master"],
	propose_product_update: ["product_master"],
	propose_product_publish: ["product_master"],
	inventory_read: ["inventory"],
	propose_inventory: ["inventory"],
	propose_store_products: ["store_products"],
	propose_blog_post: ["blog"],
	site_read: ["site"],
	propose_page_patch: ["site"],
	propose_site_patch: ["site"],
	propose_new_page: ["site"],
	propose_page_seo: ["site"],
	propose_page_translation: ["site"],
	propose_theme_change: ["site"],
	propose_navigation: ["site"],
	propose_site_languages: ["site"],
	store_categories: ["store_categories"],
	propose_store_categories: ["store_categories"],
	store_discounts: ["store_discounts"],
	propose_store_discounts: ["store_discounts"],
	store_orders: ["store_orders"],
	propose_store_orders: ["store_orders"],
	store_customers: ["store_customers"],
	propose_store_customers: ["store_customers"],
	start_campaign: ["campaigns"],
	store_reports: ["store_reports"],
	store_todos: ["store_reports"],
	propose_publish: ["site"],
	// Payload products (opt-in capability): built by shop-product-tools.ts after the tools above
	propose_shop_product_update: ["shop_products"],
	propose_shop_product_status: ["shop_products"],
	propose_shop_product_drafts: ["shop_products"],
	propose_shop_products_setup: ["shop_products"],
} as const satisfies Record<string, readonly Capability[] | null>;

export type MerchantToolName = keyof typeof TOOL_CAPABILITIES;

/**
 * A set that holds a capability but not the one it needs loses it (store_products without product_master);
 * the opt-in capability loses against the one it excludes (shop_products next to product_master). Boot
 * already refuses both lists, so this only keeps hand-built sets coherent.
 */
export function capabilitySet(list: Iterable<Capability> | undefined): CapabilitySet {
	if (list === undefined) return ALL_CAPABILITIES;
	const requested = new Set(list);
	const kept = [...requested].filter((capability) => {
		const needed = CAPABILITY_REQUIRES[capability] ?? [];
		const clash = (CAPABILITY_CONFLICTS[capability] ?? []).some((other) => requested.has(other));
		return needed.every((other) => requested.has(other)) && !clash;
	});
	return new Set(kept);
}

/** Server set (`AI_AGENT_CAPABILITIES`) narrowed by what the signed context token allows for this request. */
export function effectiveCapabilities(server: readonly Capability[] | undefined, claim: readonly string[] | undefined): CapabilitySet {
	const base = capabilitySet(server);
	if (claim === undefined) return base;
	const allowed = new Set(claim.filter(isCapability));
	return capabilitySet([...base].filter((capability) => allowed.has(capability)));
}

/** Stable text of a set (canonical order): the key instructions and prompts are cached under. */
export function capabilityKey(set: CapabilitySet): string {
	return CAPABILITIES.filter((capability) => set.has(capability)).join(",");
}

export function toolAllowed(name: MerchantToolName, set: CapabilitySet): boolean {
	const needed: readonly Capability[] | null = TOOL_CAPABILITIES[name];
	return needed === null || needed.some((capability) => set.has(capability));
}

/** The tools of `set`, in their original (cache-stable) order. */
export function filterMerchantTools<T extends Partial<Record<MerchantToolName, unknown>>>(tools: T, set: CapabilitySet): Partial<T> {
	if (set === ALL_CAPABILITIES) return tools;
	return Object.fromEntries(Object.entries(tools).filter(([name]) => toolAllowed(name as MerchantToolName, set))) as Partial<T>;
}
