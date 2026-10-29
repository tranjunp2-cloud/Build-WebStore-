import "server-only";

import config from "@payload-config";
import { getPayload, type User } from "payload";
import type { AgentActor } from "../context";

/**
 * Which products a section can show. The storefront lists a site's products that are `active` and not deleted
 * (api/storefront/products): a product of the workspace that is a draft, archived, deleted or on another site
 * never appears, so choosing it must not be reported as shown. Out of stock products DO show (with a
 * "Sold out" badge), and so do products without a photo (a placeholder).
 */

type ProductRow = { id: string | number; name?: string; inventory?: number; images?: unknown };

export interface ProductChoice {
	/** products of the workspace among the ids (anything else is not a product of this store) */
	known: Map<string, string>;
	/** the ones the storefront shows, with what the card should say about them */
	shown: Map<string, { name: string; hasPhoto: boolean; soldOut: boolean }>;
}

/** The where-clause the storefront applies to every product list: this site, active, not deleted. */
export function storefrontProductWhere(siteId: string | number | undefined, tenantId: string): Array<Record<string, unknown>> {
	return [
		{ tenant: { equals: tenantId } },
		...(siteId === undefined ? [] : [{ site: { equals: siteId } }]),
		{ status: { equals: "active" } },
		{ deletedAt: { exists: false } },
	];
}

/** A product row has at least one picture (an `images` row with an image). */
export function hasPhoto(images: unknown): boolean {
	return Array.isArray(images) && images.some((row) => Boolean(row && typeof row === "object" && (row as { image?: unknown }).image));
}

export async function productChoice(actor: AgentActor, tenantId: string, siteId: string | number | undefined, ids: string[]): Promise<ProductChoice> {
	if (ids.length === 0) return { known: new Map(), shown: new Map() };
	const cms = await getPayload({ config });
	const user = actor.user as unknown as User;
	const read = (where: unknown, select: Record<string, true>) =>
		cms.find({ collection: "products", where, depth: 0, limit: ids.length, overrideAccess: false, user, select } as Parameters<typeof cms.find>[0]);
	const [known, shown] = await Promise.all([
		read({ and: [{ tenant: { equals: tenantId } }, { id: { in: ids } }] }, { name: true }),
		read({ and: [...storefrontProductWhere(siteId, tenantId), { id: { in: ids } }] }, { name: true, inventory: true, images: true }),
	]);
	return {
		known: new Map((known.docs as unknown as ProductRow[]).map((doc) => [String(doc.id), doc.name ?? ""])),
		shown: new Map(
			(shown.docs as unknown as ProductRow[]).map((doc) => [
				String(doc.id),
				{ name: doc.name ?? "", hasPhoto: hasPhoto(doc.images), soldOut: typeof doc.inventory === "number" && doc.inventory <= 0 },
			]),
		),
	};
}

const names = (list: string[]) => list.slice(0, 5).join(", ") + (list.length > 5 ? ` +${list.length - 5}` : "");

/**
 * "Shows 2 of 3 chosen products": what a section with these ids puts on the live site and why the others stay
 * out, so the copilot reports no more than that. ok = every chosen product shows.
 */
export function describeProductChoice(section: string, ids: readonly string[], choice: ProductChoice, includeOutOfStock = true): { ok: boolean; detail: string } {
	const label = (id: string) => `“${choice.shown.get(id)?.name || choice.known.get(id) || id}”`;
	// a grid set to hide sold out products drops them from the list too
	const hiddenSoldOut = includeOutOfStock ? [] : ids.filter((id) => choice.shown.get(id)?.soldOut);
	const hidden = ids.filter((id) => !choice.shown.has(id));
	const shown = ids.filter((id) => choice.shown.has(id) && !hiddenSoldOut.includes(id));
	const noPhoto = shown.filter((id) => !choice.shown.get(id)?.hasPhoto);
	const soldOut = shown.filter((id) => choice.shown.get(id)?.soldOut);
	const parts = [
		`${section} shows ${shown.length} of ${ids.length} chosen product${ids.length === 1 ? "" : "s"} on the live site.`,
		hidden.length > 0 ? `Not shown (not on sale on this site: draft, archived or deleted): ${names(hidden.map(label))}.` : null,
		hiddenSoldOut.length > 0 ? `Sold out and this grid hides sold out products (turn on includeOutOfStock to show them): ${names(hiddenSoldOut.map(label))}.` : null,
		noPhoto.length > 0 ? `No photo (a placeholder shows): ${names(noPhoto.map(label))}.` : null,
		soldOut.length > 0 ? `Sold out (shown with a “Sold out” badge): ${names(soldOut.map(label))}.` : null,
	];
	return { ok: hidden.length === 0 && hiddenSoldOut.length === 0, detail: parts.filter(Boolean).join(" ") };
}
