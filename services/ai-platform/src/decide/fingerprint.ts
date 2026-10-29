import { createHash } from "node:crypto";

/** JSON with object keys sorted at every level — equal values, equal strings. */
export function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
	if (value !== null && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, entry]) => entry !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/**
 * Content address of one question: same org, model, instructions, options and
 * state → same answer. Any change to the question re-keys the cache by itself.
 */
export function decisionFingerprint(input: {
	organizationId: string;
	model: string;
	instructions: string;
	criteria: Record<string, string>;
	state: Record<string, unknown>;
}): string {
	return createHash("sha256").update(stableStringify(input)).digest("hex");
}
