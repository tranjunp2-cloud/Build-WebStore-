import { describe, expect, it } from "vitest";
import { applyTranslatedStrings, flattenTranslatableStrings, TranslateBlocksInputSchema } from "./i18n";

describe("i18n.translate-blocks field paths [TC-AICP-23]", () => {
	it("round-trips nested string leaves and leaves everything else untouched", () => {
		const content = { title: "Hi", faq: { items: [{ q: "Why?", a: " " }] }, count: 2, on: true, none: null };

		const { fields, paths } = flattenTranslatableStrings(content);
		const result = applyTranslatedStrings(content, paths, { title: "Hai", "faq.items.0.q": "Kenapa?" });

		expect(fields).toEqual({ title: "Hi", "faq.items.0.q": "Why?" });
		expect(result).toEqual({ title: "Hai", faq: { items: [{ q: "Kenapa?", a: " " }] }, count: 2, on: true, none: null });
		expect(content.title).toBe("Hi");
	});

	it("keeps colliding dotted keys apart and skips prototype keys", () => {
		const content = JSON.parse('{"a.b":"one","a":{"b":"two"},"__proto__":{"x":"evil"}}') as Record<string, unknown>;

		const { fields, paths } = flattenTranslatableStrings(content);
		const result = applyTranslatedStrings(content, paths, { "a.b": "satu", "a.b#2": "dua" });

		expect(Object.keys(fields)).toEqual(["a.b", "a.b#2"]);
		expect(result["a.b"]).toBe("satu");
		expect(result.a).toEqual({ b: "dua" });
		expect(({} as Record<string, unknown>).x).toBeUndefined();
	});

	it("rejects an empty field set", () => {
		expect(TranslateBlocksInputSchema.safeParse({ targetLocale: "ms", fields: {} }).success).toBe(false);
	});
});
