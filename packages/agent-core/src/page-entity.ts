import type { EntityRef } from "./schemas";

/** Route words that are pages, not record ids. */
const NOT_IDS = new Set(["new", "categories", "create", "import", "settings", "edit"]);

/**
 * The record a dashboard page shows, so the copilot can read "this post" /
 * "this product". `surface` is the app whose routes the path belongs to:
 * the prime-web dashboard, or the commerce portal (its own paths, e.g.
 * `/products/prod_…` there is a Product Master product), or the "shop"
 * dashboard of a deployment whose products are its own Payload products:
 * `/products/:id` there is a product (in the "dashboard" surface it is not).
 */
export function entityFromPath(pathname: string, surface: "dashboard" | "portal" | "shop"): EntityRef | undefined {
	const [first, second, third] = pathname.split("?")[0]?.split("/").filter(Boolean) ?? [];
	const id = (value: string | undefined) => (value && !NOT_IDS.has(value) ? decodeURIComponent(value) : undefined);
	if (surface === "dashboard" || surface === "shop") {
		if (first === "blog" && id(second)) return { kind: "blog_post", id: id(second) as string };
		if (surface === "shop") return first === "products" && id(second) ? { kind: "product", id: id(second) as string } : undefined;
		if (first === "catalog" && second === "products" && id(third)) return { kind: "product", id: id(third) as string };
		return undefined;
	}
	if (first === "products" && id(second)) return { kind: "product", id: id(second) as string };
	return undefined;
}
