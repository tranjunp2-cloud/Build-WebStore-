import type { Actor, HistoryArea, TestResult } from "./settings-types";

export interface StoredSecret {
	ciphertext: string;
	iv: string;
	tag: string;
	last4: string;
	keyVersion: string;
	setBy: string | null;
	setAt: Date | null;
}

export interface ProviderRow {
	id: string;
	kind: "builtin" | "compat";
	/** null = inherit (on) */
	enabled: boolean | null;
	baseUrl: string | null;
	options: { reasoning?: boolean; structuredOutputs?: boolean };
	secret: StoredSecret | null;
	lastTest: TestResult | null;
	updatedBy: string | null;
	updatedAt: Date;
}

export interface GatewayRow {
	baseUrl: string | null;
	/** provider id -> path, only where it differs from the code default */
	paths: Record<string, string>;
	token: StoredSecret | null;
	updatedBy: string | null;
	updatedAt: Date;
}

/** One routing slot set in Studio. `effort` null = send no effort; `timeoutMs` null = the runtime model timeout. */
export interface StoredTier {
	chain: string[];
	effort?: string | null;
	timeoutMs: number | null;
	format?: string | null;
}
export type RoutingStored = Partial<Record<"fast" | "balanced" | "quality" | "image", StoredTier>>;

export interface SettingsData {
	providers: ProviderRow[];
	gateway: GatewayRow | null;
	routing: RoutingStored;
	/** task id -> tier */
	tasks: Record<string, string>;
	runtime: Record<string, unknown>;
	updatedAt: Date | null;
}

export const EMPTY_SETTINGS: SettingsData = { providers: [], gateway: null, routing: {}, tasks: {}, runtime: {}, updatedAt: null };

/** One atomic write; absent parts stay as they are. */
export interface SettingsChange {
	providers?: { upsert?: ProviderRow[]; remove?: string[] };
	gateway?: GatewayRow;
	/** replaces the whole routing document */
	routing?: RoutingStored;
	tasks?: { set?: Record<string, string>; remove?: string[] };
	runtime?: { set?: Record<string, unknown>; remove?: string[] };
}

export interface HistoryRecord {
	id: string;
	at: Date;
	actor: Actor;
	area: HistoryArea;
	summary: string;
	/** non-secret state after the change */
	snapshot: unknown;
	restorable: boolean;
}

export interface SettingsStore {
	load(): Promise<SettingsData>;
	/** Writes the change and its history entry in one transaction. */
	apply(change: SettingsChange, history?: HistoryRecord): Promise<void>;
	listHistory(options: { area?: HistoryArea; limit: number }): Promise<HistoryRecord[]>;
	getHistory(id: string): Promise<HistoryRecord | null>;
}

export const SETTINGS_STORE = Symbol("AI_PLATFORM_SETTINGS_STORE");

/** The pure effect of a change on the settings; the in-memory store and the history snapshots use it. */
export function applyChange(data: SettingsData, change: SettingsChange, now: Date = new Date()): SettingsData {
	let providers = data.providers;
	if (change.providers) {
		const removed = new Set(change.providers.remove ?? []);
		const upserts = new Map((change.providers.upsert ?? []).map((row) => [row.id, row]));
		providers = [...providers.filter((row) => !removed.has(row.id) && !upserts.has(row.id)), ...upserts.values()];
	}
	const tasks = { ...data.tasks, ...change.tasks?.set };
	for (const id of change.tasks?.remove ?? []) delete tasks[id];
	const runtime = { ...data.runtime, ...change.runtime?.set };
	for (const key of change.runtime?.remove ?? []) delete runtime[key];
	return { providers, gateway: change.gateway ?? data.gateway, routing: change.routing ?? data.routing, tasks, runtime, updatedAt: now };
}

export class InMemorySettingsStore implements SettingsStore {
	data: SettingsData = EMPTY_SETTINGS;
	history: HistoryRecord[] = [];

	async load(): Promise<SettingsData> {
		return structuredClone(this.data);
	}

	async apply(change: SettingsChange, history?: HistoryRecord): Promise<void> {
		this.data = applyChange(this.data, structuredClone(change));
		if (history) this.history.unshift(structuredClone(history));
	}

	async listHistory({ area, limit }: { area?: HistoryArea; limit: number }): Promise<HistoryRecord[]> {
		return this.history.filter((entry) => !area || entry.area === area).slice(0, limit);
	}

	async getHistory(id: string): Promise<HistoryRecord | null> {
		return this.history.find((entry) => entry.id === id) ?? null;
	}
}
