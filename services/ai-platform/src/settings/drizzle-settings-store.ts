import { Inject, Injectable, Logger } from "@nestjs/common";
import { desc, eq, inArray } from "drizzle-orm";
import { DB, type Database } from "../database/database.module";
import { aiGatewaySettings, aiProviderSettings, aiRoutingSettings, aiRuntimeSettings, aiSettingsHistory, aiTaskRouting } from "../database/schema";
import {
	EMPTY_SETTINGS,
	type GatewayRow,
	type HistoryRecord,
	type ProviderRow,
	type RoutingStored,
	type SettingsChange,
	type SettingsData,
	type SettingsStore,
	type StoredSecret,
} from "./settings-store";
import type { Actor, HistoryArea, TestResult } from "./settings-types";

type ProviderRecord = typeof aiProviderSettings.$inferSelect;
type GatewayRecord = typeof aiGatewaySettings.$inferSelect;

function secretOf(parts: { ciphertext: string | null; iv: string | null; tag: string | null; last4: string | null; keyVersion: string | null; setBy: string | null; setAt: Date | null }): StoredSecret | null {
	if (!parts.ciphertext || !parts.iv || !parts.tag || !parts.keyVersion) return null;
	return { ciphertext: parts.ciphertext, iv: parts.iv, tag: parts.tag, last4: parts.last4 ?? "", keyVersion: parts.keyVersion, setBy: parts.setBy, setAt: parts.setAt };
}

const providerOf = (row: ProviderRecord): ProviderRow => ({
	id: row.id,
	kind: row.kind === "compat" ? "compat" : "builtin",
	enabled: row.enabled,
	baseUrl: row.baseUrl,
	options: (row.options ?? {}) as ProviderRow["options"],
	secret: secretOf({ ciphertext: row.secretCiphertext, iv: row.secretIv, tag: row.secretTag, last4: row.secretLast4, keyVersion: row.secretKeyVersion, setBy: row.secretSetBy, setAt: row.secretSetAt }),
	lastTest: (row.lastTest ?? null) as TestResult | null,
	updatedBy: row.updatedBy,
	updatedAt: row.updatedAt,
});

const gatewayOf = (row: GatewayRecord): GatewayRow => ({
	baseUrl: row.baseUrl,
	paths: (row.paths ?? {}) as Record<string, string>,
	token: secretOf({ ciphertext: row.tokenCiphertext, iv: row.tokenIv, tag: row.tokenTag, last4: row.tokenLast4, keyVersion: row.tokenKeyVersion, setBy: row.tokenSetBy, setAt: row.tokenSetAt }),
	updatedBy: row.updatedBy,
	updatedAt: row.updatedAt,
});

const providerRecord = (row: ProviderRow): ProviderRecord => ({
	id: row.id,
	kind: row.kind,
	enabled: row.enabled,
	baseUrl: row.baseUrl,
	options: row.options,
	secretCiphertext: row.secret?.ciphertext ?? null,
	secretIv: row.secret?.iv ?? null,
	secretTag: row.secret?.tag ?? null,
	secretLast4: row.secret?.last4 ?? null,
	secretKeyVersion: row.secret?.keyVersion ?? null,
	secretSetBy: row.secret?.setBy ?? null,
	secretSetAt: row.secret?.setAt ?? null,
	lastTest: row.lastTest,
	updatedBy: row.updatedBy,
	updatedAt: row.updatedAt,
});

const historyOf = (row: typeof aiSettingsHistory.$inferSelect): HistoryRecord => ({
	id: row.id,
	at: row.at,
	actor: row.actor as Actor,
	area: row.area as HistoryArea,
	summary: row.summary,
	snapshot: row.snapshot,
	restorable: row.restorable,
});

/**
 * Postgres-backed settings. Driver errors are rethrown without their message: drizzle puts the statement's
 * parameters (the sealed secrets) in it, and the message ends up in the server log.
 */
@Injectable()
export class DrizzleSettingsStore implements SettingsStore {
	private readonly logger = new Logger(DrizzleSettingsStore.name);

	constructor(@Inject(DB) private readonly db: Database) {}

	private fail(action: string, error: unknown): never {
		const code = (error as { cause?: { code?: string } })?.cause?.code ?? (error as { code?: string })?.code ?? "unknown";
		this.logger.error(`ai settings ${action} failed (${code})`);
		throw new Error(`AI settings ${action} failed.`);
	}

	async load(): Promise<SettingsData> {
		try {
			const [providers, gateways, routings, tasks, runtime] = await Promise.all([
				this.db.select().from(aiProviderSettings),
				this.db.select().from(aiGatewaySettings).limit(1),
				this.db.select().from(aiRoutingSettings).limit(1),
				this.db.select().from(aiTaskRouting),
				this.db.select().from(aiRuntimeSettings),
			]);
			const stamps = [...providers, ...gateways, ...routings, ...tasks, ...runtime].map((row) => row.updatedAt.getTime());
			return {
				...EMPTY_SETTINGS,
				providers: providers.map(providerOf),
				gateway: gateways[0] ? gatewayOf(gateways[0]) : null,
				routing: (routings[0]?.value ?? {}) as RoutingStored,
				tasks: Object.fromEntries(tasks.map((row) => [row.taskId, row.tier])),
				runtime: Object.fromEntries(runtime.map((row) => [row.key, row.value])),
				updatedAt: stamps.length > 0 ? new Date(Math.max(...stamps)) : null,
			};
		} catch (error) {
			return this.fail("load", error);
		}
	}

	async apply(change: SettingsChange, history?: HistoryRecord): Promise<void> {
		const now = new Date();
		try {
			await this.db.transaction(async (tx) => {
				for (const row of change.providers?.upsert ?? []) {
					const record = { ...providerRecord(row), updatedAt: now };
					await tx.insert(aiProviderSettings).values(record).onConflictDoUpdate({ target: aiProviderSettings.id, set: record });
				}
				if (change.providers?.remove?.length) await tx.delete(aiProviderSettings).where(inArray(aiProviderSettings.id, change.providers.remove));
				if (change.gateway) {
					const g = change.gateway;
					const record = {
						id: "gateway",
						baseUrl: g.baseUrl,
						paths: g.paths,
						tokenCiphertext: g.token?.ciphertext ?? null,
						tokenIv: g.token?.iv ?? null,
						tokenTag: g.token?.tag ?? null,
						tokenLast4: g.token?.last4 ?? null,
						tokenKeyVersion: g.token?.keyVersion ?? null,
						tokenSetBy: g.token?.setBy ?? null,
						tokenSetAt: g.token?.setAt ?? null,
						updatedBy: g.updatedBy,
						updatedAt: now,
					};
					await tx.insert(aiGatewaySettings).values(record).onConflictDoUpdate({ target: aiGatewaySettings.id, set: record });
				}
				if (change.routing) {
					const record = { id: "routing", value: change.routing, updatedAt: now };
					await tx.insert(aiRoutingSettings).values(record).onConflictDoUpdate({ target: aiRoutingSettings.id, set: record });
				}
				for (const [taskId, tier] of Object.entries(change.tasks?.set ?? {})) {
					await tx.insert(aiTaskRouting).values({ taskId, tier, updatedAt: now }).onConflictDoUpdate({ target: aiTaskRouting.taskId, set: { tier, updatedAt: now } });
				}
				if (change.tasks?.remove?.length) await tx.delete(aiTaskRouting).where(inArray(aiTaskRouting.taskId, change.tasks.remove));
				for (const [key, value] of Object.entries(change.runtime?.set ?? {})) {
					await tx.insert(aiRuntimeSettings).values({ key, value, updatedAt: now }).onConflictDoUpdate({ target: aiRuntimeSettings.key, set: { value, updatedAt: now } });
				}
				if (change.runtime?.remove?.length) await tx.delete(aiRuntimeSettings).where(inArray(aiRuntimeSettings.key, change.runtime.remove));
				if (history) await tx.insert(aiSettingsHistory).values(history);
			});
		} catch (error) {
			this.fail("save", error);
		}
	}

	async listHistory({ area, limit }: { area?: HistoryArea; limit: number }): Promise<HistoryRecord[]> {
		try {
			const query = this.db.select().from(aiSettingsHistory);
			const rows = await (area ? query.where(eq(aiSettingsHistory.area, area)) : query).orderBy(desc(aiSettingsHistory.at)).limit(limit);
			return rows.map(historyOf);
		} catch (error) {
			return this.fail("history read", error);
		}
	}

	async getHistory(id: string): Promise<HistoryRecord | null> {
		try {
			const [row] = await this.db.select().from(aiSettingsHistory).where(eq(aiSettingsHistory.id, id)).limit(1);
			return row ? historyOf(row) : null;
		} catch (error) {
			return this.fail("history read", error);
		}
	}
}
