import type { ChangeSet } from "@ech/agent-core";
import { ANY_ENTITY, type AgentChange, type AgentChangeEntity } from "./types";

/**
 * Which records an action kind touches. Used when the change set carries no `result.entities` (older cards, an undo of a
 * change that listed none): the screens showing that kind refetch.
 */
const ENTITY_KINDS: ReadonlyArray<readonly [prefix: string, entityKinds: readonly string[]]> = [
	["blog.", ["blog_post"]],
	["shop_product.", ["product"]],
	["product.", ["product"]],
	["store.categories_", ["store_category"]],
	["store.discounts_", ["store_discount"]],
	["store.orders_", ["store_order"]],
	["store.customers_", ["store_customer", "contact_lead", "lead_reply", "email_template"]],
	["site.", ["site"]],
];

/** Pictures the change brings in (a chat upload, a stock photo) become new media-library rows. */
const NEW_PICTURE = /"(?:attachment|pixabay):/;

function entitiesOf(changeSet: ChangeSet): AgentChangeEntity[] {
	const listed = (changeSet.result?.entities ?? []).map(({ kind, id }) => ({ kind, id }));
	const kind = changeSet.action?.kind ?? "";
	const fallback = listed.length > 0 ? [] : (ENTITY_KINDS.find(([prefix]) => kind.startsWith(prefix))?.[1] ?? []).map((k) => ({ kind: k, id: ANY_ENTITY }));
	const media = NEW_PICTURE.test(JSON.stringify(changeSet.action?.payload ?? {})) ? [{ kind: "media", id: ANY_ENTITY }] : [];
	return [...listed, ...fallback, ...media];
}

/** The change a decided or undone change set stands for; null when nothing was written (rejected, expired, no action). */
export function changeFromChangeSet(changeSet: ChangeSet, now: number = Date.now()): AgentChange | null {
	if (!changeSet.action) return null;
	const action = changeSet.status === "applied" ? "applied" : changeSet.status === "reverted" ? "undone" : null;
	if (!action) return null;
	return { action, kind: changeSet.action.kind, domain: changeSet.domain, entities: entitiesOf(changeSet), changeSetId: changeSet.id, at: now };
}
