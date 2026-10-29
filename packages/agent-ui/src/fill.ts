/** "{done} of {all}" → text. `{s}` is the English plural ending: "" when `n` is 1, "s" otherwise. */
export function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => (key === "s" ? (values.n === 1 ? "" : "s") : String(values[key] ?? "")));
}
