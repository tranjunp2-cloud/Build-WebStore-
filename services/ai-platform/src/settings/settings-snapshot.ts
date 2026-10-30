import { z } from "zod";
import type { ProviderRow, RoutingStored, SettingsChange, SettingsData } from "./settings-store";

/** The NON-secret state kept with every history entry: no key, token, ciphertext or test result. */
export function snapshotOf(data: SettingsData) {
	return {
		providers: data.providers.map((row) => ({ id: row.id, kind: row.kind, enabled: row.enabled, baseUrl: row.baseUrl, options: row.options })),
		gateway: { baseUrl: data.gateway?.baseUrl ?? null, paths: data.gateway?.paths ?? {} },
		routing: data.routing,
		tasks: data.tasks,
		runtime: data.runtime,
	};
}

const SnapshotSchema = z.object({
	providers: z.array(
		z.object({
			id: z.string(),
			kind: z.enum(["builtin", "compat"]),
			enabled: z.boolean().nullable(),
			baseUrl: z.string().nullable(),
			options: z.object({ reasoning: z.boolean().optional(), structuredOutputs: z.boolean().optional() }),
		}),
	),
	gateway: z.object({ baseUrl: z.string().nullable(), paths: z.record(z.string(), z.string()) }),
	routing: z.record(z.string(), z.unknown()),
	tasks: z.record(z.string(), z.string()),
	runtime: z.record(z.string(), z.unknown()),
});

/**
 * The change that brings the settings back to a snapshot. Keys and the gateway token are never touched; a
 * provider that has a key keeps it. Custom endpoints created after the snapshot stay (they would lose their key).
 */
export function changeToRestore(raw: unknown, current: SettingsData, actor: string): SettingsChange | null {
	const parsed = SnapshotSchema.safeParse(raw);
	if (!parsed.success) return null;
	const snapshot = parsed.data;
	const now = new Date();
	const upsert: ProviderRow[] = [];
	for (const wanted of snapshot.providers) {
		const row = current.providers.find((candidate) => candidate.id === wanted.id);
		upsert.push({
			secret: null,
			lastTest: null,
			...row,
			id: wanted.id,
			kind: wanted.kind,
			enabled: wanted.enabled,
			baseUrl: wanted.baseUrl,
			options: wanted.options,
			updatedBy: actor,
			updatedAt: now,
		});
	}
	for (const row of current.providers) {
		if (row.kind === "builtin" && !snapshot.providers.some((wanted) => wanted.id === row.id)) {
			upsert.push({ ...row, enabled: null, baseUrl: null, options: {}, updatedBy: actor, updatedAt: now });
		}
	}
	return {
		providers: { upsert },
		gateway: { token: null, ...current.gateway, baseUrl: snapshot.gateway.baseUrl, paths: snapshot.gateway.paths, updatedBy: actor, updatedAt: now },
		routing: snapshot.routing as RoutingStored,
		tasks: { set: snapshot.tasks, remove: Object.keys(current.tasks).filter((id) => !(id in snapshot.tasks)) },
		runtime: { set: snapshot.runtime, remove: Object.keys(current.runtime).filter((key) => !(key in snapshot.runtime)) },
	};
}
