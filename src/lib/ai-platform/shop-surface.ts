import { type EntityRef, entityFromPath } from "@ech/agent-core";

/**
 * What the copilot's dock pins for a dashboard path on this deployment, where the shop's products are its own
 * Payload `products` (the `shop_products` capability): `/products` is module "products" and `/products/:id`
 * is the product that page shows, so "this product" can be read. Client-safe (no server imports).
 */

/** The page's module word: the first path segment ("products", "blog", "orders"…), "dashboard" for `/`. */
export function moduleForPath(pathname: string): string {
	return pathname.split("?")[0]?.split("/").filter(Boolean)[0] ?? "dashboard";
}

/** The record the path shows (a product on `/products/:id`, a post on `/blog/:id`), if any. */
export function entityForPath(pathname: string): EntityRef | undefined {
	return entityFromPath(pathname, "shop");
}
