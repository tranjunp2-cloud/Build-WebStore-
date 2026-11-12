/** JSON with object keys in sorted order, so two values holding the same data compare equal whatever order the keys came in. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
				.map(([key, entry]) => [key, canonical(entry)]),
		);
	}
	return value;
}

/**
 * Whether a stored plan and the ops the checks produce now say the same thing. A plan comes back from the AI
 * platform's jsonb column, which stores object keys by length then name (`{op, block, afterBlockId}`), while the
 * checks build `{op, afterBlockId, block}`: a plain `JSON.stringify` comparison called an unchanged plan "changed".
 * Array order still matters (it is the order of the sections).
 */
export function samePlan(a: unknown, b: unknown): boolean {
	return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
