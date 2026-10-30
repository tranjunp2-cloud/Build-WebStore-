/**
 * What the merchant copilot may do in one deployment. `AI_AGENT_CAPABILITIES`
 * (comma list) picks the set; unset means all of them. The tool map, the
 * system instructions and the narrowed tool schemas follow from the set
 * (see `agent/merchant-capabilities.ts`).
 */
export const CAPABILITIES = [
	/** the website editor: site_read and every propose_page_* / site / theme / navigation / publish tool */
	"site",
	/** blog posts: propose_blog_post / propose_blog_posts, the blog_post kind of read / search / update / status tools */
	"blog",
	/** find_images with source "stock" (Pixabay) */
	"stock_photos",
	/** find_images with source "library" (the shop's own media) */
	"media_library",
	/** generate_image */
	"image_generation",
	/** Product Master: product drafts / update / publish, the product kind of the item tools, ask_user product_details */
	"product_master",
	/** inventory_read and propose_inventory */
	"inventory",
	/** Product Store: propose_store_products, addToStore on page patches, the "store" page rule. Needs product_master */
	"store_products",
	/**
	 * Payload products (the staging release, where the shop's products are prime-web's own `products`
	 * collection, not Product Master): propose_shop_product_update / _status / _drafts and the product
	 * kind of read_item / search_items. Opt-in: never part of "unset = all". Excludes product_master and store_products
	 */
	"shop_products",
	/** the Product Store's categories: store_categories and propose_store_categories (create / rename / move / delete, put products in one) */
	"store_categories",
	/** the shop's discount codes: store_discounts and propose_store_discounts (create / change / activate / pause / delete). Works next to either product world */
	"store_discounts",
	/** the shop's orders: store_orders (needs-action summary, list, one order in full) and propose_store_orders (confirm / ship / complete, payment proofs, cancel, refund, note). Works next to either product world */
	"store_orders",
	/** the shop's customers, its contact-form leads and its email templates: store_customers and propose_store_customers (customer rank / notes, lead status and replies, template text). Works next to either product world */
	"store_customers",
	/** one-prompt promo campaigns: start_campaign links the discount code, the homepage banner and the announcement post in one group. Needs store_discounts and site */
	"campaigns",
	/** read-only reports and insights: store_reports (sales, best sellers, discount performance, orders by status, traffic, with a comparison to the previous period) and store_todos (what needs attention now). Works next to either product world */
	"store_reports",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: string): value is Capability {
	return (CAPABILITIES as readonly string[]).includes(value);
}

/** Capabilities that are never on by default (unset `AI_AGENT_CAPABILITIES`): they change what "product" means. */
export const OPT_IN_CAPABILITIES: readonly Capability[] = ["shop_products"];

/** Capabilities that cannot be combined: both would claim the product kind of the item tools. */
export const CAPABILITY_CONFLICTS: Partial<Record<Capability, readonly Capability[]>> = {
	shop_products: ["product_master", "store_products"],
};

/** Capabilities that only work next to other ones (all of them). */
export const CAPABILITY_REQUIRES: Partial<Record<Capability, readonly Capability[]>> = {
	store_products: ["product_master"],
	campaigns: ["store_discounts", "site"],
};

/**
 * Parses an `AI_AGENT_CAPABILITIES` value. Unknown names and a capability
 * without the one it needs are errors: a typo must not silently hide tools.
 */
export function parseCapabilityList(raw: string): { capabilities: Capability[] } | { error: string } {
	const names = raw
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean);
	if (names.length === 0) return { error: `list at least one of: ${CAPABILITIES.join(", ")} (or leave it unset for all)` };
	const unknown = names.filter((name) => !isCapability(name));
	if (unknown.length > 0) return { error: `unknown capability ${unknown.join(", ")}; known: ${CAPABILITIES.join(", ")}` };
	const capabilities = CAPABILITIES.filter((capability) => names.includes(capability));
	for (const capability of capabilities) {
		const missing = (CAPABILITY_REQUIRES[capability] ?? []).filter((needed) => !capabilities.includes(needed));
		if (missing.length > 0) return { error: `${capability} needs ${missing.join(" and ")}` };
		const clash = (CAPABILITY_CONFLICTS[capability] ?? []).find((other) => capabilities.includes(other));
		if (clash) return { error: `${capability} cannot be combined with ${clash}` };
	}
	return { capabilities };
}
