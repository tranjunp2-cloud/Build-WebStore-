import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import { ZodError } from "zod";
import type { PlanCode } from "@/collections/PlanSubscriptions";
import type { ProductActor } from "@/lib/products/save-product";
import { canUse, getActivePlanSubscription } from "@/lib/subscriptions/plan-subscription";
import type { Payload } from "payload";
import type { AgentActor } from "../context";
import { type ProductDoc, StoreProductError } from "../agent-tools/store-product-doc";
import { loadShopProduct } from "../agent-tools/store-product-tools";
import { ChangeSetApplyError, staleChange } from "./errors";

/** Helpers the three store-product appliers (update / status / drafts) and their undo share. */

const UNDO_DAYS = 7;
export const undoUntil = () => new Date(Date.now() + UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString();

export const CHANGED_SINCE = "This product changed after the assistant drafted the edit. Ask again so it starts from the latest version.";
export const productLink = (id: string | number) => [{ label: "Open product", href: `/products/${encodeURIComponent(String(id))}` }];
export const productEntity = (id: string | number, label: string) => ({ kind: "product", id: String(id), label });

/** Who the product module writes for: the approving user in the workspace they act in. */
export const productActor = (actor: AgentActor): ProductActor => ({
	user: actor.user as unknown as ProductActor["user"],
	tenantId: /^\d+$/.test(actor.tenantId) ? Number(actor.tenantId) : actor.tenantId,
});

export const isoTime = (value: string | undefined | null) => (value ? Date.parse(value) : Number.NaN);

/** The collection's own plan gate, said plainly (the Products access rule would only answer "forbidden"). */
export async function assertProductManagement(cms: Payload, actor: AgentActor) {
	// platform staff pass the collection's access rule without a plan
	if (actor.user.roles?.includes("super-admin")) return;
	const sub = await getActivePlanSubscription(cms, actor.tenantId);
	if (!sub) throw new ChangeSetApplyError("Your plan has expired, so products can't be edited.", 403);
	if (!(await canUse(cms, sub.plan as PlanCode, "product_management"))) throw new ChangeSetApplyError("Product management is not on your current plan.", 403);
}

/** A product of this workspace as it is stored now (depth 0: ids, not populated documents); gone → closed (409, final). */
export async function currentProduct(cms: Payload, actor: AgentActor, id: string): Promise<ProductDoc> {
	try {
		return await loadShopProduct(actor, id, cms, 0);
	} catch (error) {
		if (error instanceof StoreProductError) throw staleChange("This product no longer exists.");
		throw error;
	}
}

/** The version guard: a product edited since the draft can never take this change, which is closed with the reason. */
export function assertSameVersion(doc: ProductDoc, base: string) {
	const stored = isoTime(doc.updatedAt);
	if (!Number.isFinite(stored) || stored !== isoTime(base)) throw staleChange(CHANGED_SINCE);
}

const FIELD_LABEL: Record<string, string> = { price: "price", sku: "SKU", inventory: "stock", weight: "weight", variants: "options" };

/** What a save refusal means to the merchant. Unknown failures are logged and answered generically. */
export function saveFailure(error: unknown): ChangeSetApplyError {
	if (error instanceof ChangeSetApplyError) return error;
	if (error instanceof ZodError) return new ChangeSetApplyError(error.issues[0]?.message ?? "A value is not valid.", 422);
	const message = error instanceof Error ? error.message : "";
	try {
		const parsed = JSON.parse(message) as { code?: string; message?: string; missingFields?: string[] };
		if (parsed.code === "PUBLISH_BLOCKED") {
			const missing = (parsed.missingFields ?? []).map((field) => FIELD_LABEL[field] ?? field);
			return new ChangeSetApplyError(`The product can't be on sale yet — missing: ${missing.join(", ") || "required details"}.`, 422);
		}
		if (parsed.code === "FIELD_ERRORS") return new ChangeSetApplyError(parsed.message ?? "A SKU is already in use.", 422);
	} catch {
		// not a structured error
	}
	if (/not available on your current plan/i.test(message)) return new ChangeSetApplyError(message, 403);
	const named = error as { name?: string; data?: { errors?: Array<{ message?: string; path?: string | null }> } } | null;
	if (named?.name === "Forbidden") return new ChangeSetApplyError("You can't edit this product.", 403);
	if (named?.name === "ValidationError") {
		const detail = (named.data?.errors ?? []).map((entry) => (entry.path ? `${entry.path}: ${entry.message}` : entry.message)).filter(Boolean).join("; ");
		return new ChangeSetApplyError(detail ? `The product was not saved — ${detail}.` : "The product was not saved.", 422);
	}
	console.error("[agent-apply] product save failed", error instanceof Error ? error.name : "unknown");
	return new ChangeSetApplyError("The product could not be saved. Try again.", 422);
}

export type ProductResult = Pick<ChangeSetResult, "entities" | "links" | "undo">;
