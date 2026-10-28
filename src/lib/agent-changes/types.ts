/** A record the assistant changed. `id` is "*" when only the kind is known (screens showing that kind refetch). */
export type AgentChangeEntity = { kind: string; id: string };

/** One applied or undone change set, as the screens need it: what kind of change and which records. */
export type AgentChange = {
	action: "applied" | "undone";
	/** the change set's action kind, e.g. `shop_product.update`, `store.discounts_patch` */
	kind: string;
	domain?: string;
	entities: AgentChangeEntity[];
	changeSetId: string;
	at: number;
};

/** Changes that arrived within one coalescing window (an "Approve all", a multi-step card), merged. */
export type AgentChangeBatch = { changes: AgentChange[]; entities: AgentChangeEntity[] };

export const ANY_ENTITY = "*";
