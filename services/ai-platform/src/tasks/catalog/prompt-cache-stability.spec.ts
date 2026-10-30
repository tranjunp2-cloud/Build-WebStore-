import { AI_TASK_IDS, AI_TASKS, type AiTaskId, type AiTaskInput } from "@ech/ai-contracts";
import { describe, expect, it } from "vitest";
import type { ZodObject } from "zod";
import type { AiRequestContext } from "../../auth/context-token";
import { TASK_DEFINITIONS } from "./index";

/**
 * TC-AICP-33 — cache-stable system prompts. Provider prefix caches (DeepSeek,
 * OpenAI, Gemini implicit; Anthropic explicit) only hit when the system prompt
 * bytes repeat, so a task's `instructions` may only depend on the input fields
 * listed here: low-cardinality values (each value caches as its own variant)
 * or values that are stable per tenant/app. Everything else — merchant text,
 * site/page names, block content, per-request lists — belongs in `prompt`.
 * Adding a field to a task contract fails this spec until it is classified.
 */
const COMPOSED_STABLE = ["system", "temperature", "maxOutputTokens"] as const;

const composedSamples = (system: string): [AiTaskInput<"sitegen.site-plan">, AiTaskInput<"sitegen.site-plan">] => [
	{ system, user: "Business: Kedai Batik | batik scarves", temperature: 0.7, maxOutputTokens: 300 },
	{ system, user: "Business: Kuih Mak Teh | kuih and cakes", temperature: 0.7, maxOutputTokens: 300 },
];

const CACHE_STABLE_FIELDS: { [K in AiTaskId]: readonly (keyof AiTaskInput<K> & string)[] } = {
	"content.product-description": ["locale", "tone", "maxWords"],
	"content.translate": ["targetLocale", "sourceLocale"],
	"content.seo-meta": ["locale"],
	"copy.product-description": ["language"],
	// context = "<blockType> <field>" from the editor: a bounded, app-defined set.
	"copy.rewrite-text": ["language", "context"],
	"seo.page-meta": ["language"],
	"seo.generate-meta": [],
	"seo.generate-meta-batch": [],
	"seo.fix-meta": [],
	// tone = one of the blog editor's presets (Professional / Friendly / Persuasive).
	"copy.blog-post": ["language", "tone"],
	"seo.blog-meta": [],
	"copy.blog-post-draft": ["language", "shopName"],
	"i18n.translate-blocks": ["targetLocale"],
	"i18n.translate-product-field": ["sourceLocale", "targetLocale", "format"],
	// The tenant's whole leaf-category list: stable per tenant between catalog edits.
	"catalog.bulk-parse-products": ["locale", "categoryCandidates"],
	"catalog.split-products": [],
	// prime-web constants (block registry, THEME_ENUMS): identical for every site.
	"site.extract-business-info": [],
	// Caller-composed steps: `system` is the generator's static step prompt (per
	// category/locale at most); the business details travel in `user`.
	"sitegen.site-plan": COMPOSED_STABLE,
	"sitegen.page-blocks": COMPOSED_STABLE,
	"sitegen.personalize": COMPOSED_STABLE,
	"sitegen.sample-products": COMPOSED_STABLE,
	"sitegen.blog-seeds": COMPOSED_STABLE,
	"sitegen.blog-post-content": COMPOSED_STABLE,
	"sitegen.image-keywords": COMPOSED_STABLE,
	"i18n.translate-image-terms": COMPOSED_STABLE,
	"i18n.translate-user-input": COMPOSED_STABLE,
	// The design rules are prime-web's static migration prompt; per-store choices shape only the output schema.
	"migration.pw1-native-design": ["system"],
	"migration.pw1-brand-palette": [],
};

/** Two requests per task that differ in every field NOT listed above and match on the listed ones. */
const SAMPLES: { [K in AiTaskId]: [AiTaskInput<K>, AiTaskInput<K>] } = {
	"content.product-description": [
		{ locale: "ms-MY", productName: "Batik Scarf", facts: ["silk"], tone: "friendly", maxWords: 120 },
		{ locale: "ms-MY", productName: "Rattan Basket", facts: ["handwoven", "30 cm"], tone: "friendly", maxWords: 120 },
	],
	"content.translate": [
		{ targetLocale: "ms-MY", sourceLocale: "en", fields: { name: "Batik scarf" }, glossary: ["Kedai Batik"] },
		{ targetLocale: "ms-MY", sourceLocale: "en", fields: { title: "Rattan basket" }, glossary: ["RTN-01", "Anyaman"] },
	],
	"content.seo-meta": [
		{ locale: "en", title: "Batik Scarf", body: "Silk scarf", keywords: ["batik"] },
		{ locale: "en", title: "Rattan Basket", body: "Woven basket", keywords: ["rattan", "basket"] },
	],
	"copy.product-description": [
		{ name: "Batik Scarf", category: "Apparel", language: "ms" },
		{ name: "Rattan Basket", category: "Home", language: "ms" },
	],
	"copy.rewrite-text": [
		{ text: "Welcome to our shop", instruction: "Make it formal", context: "hero headline", language: "en" },
		{ text: "Fresh kuih daily", instruction: "Shorter", context: "hero headline", language: "en" },
	],
	"seo.page-meta": [
		{ name: "Batik Scarf", category: "Apparel", language: "ms", keywords: ["batik"] },
		{ name: "Rattan Basket", category: "Home", language: "ms", keywords: ["rattan"] },
	],
	"seo.generate-meta": [
		{ type: "product", itemName: "Batik Scarf", siteName: "Kedai Batik", context: "Silk", keywords: ["batik"] },
		{ type: "page", itemName: "About", siteName: "Kuih Mak Teh", context: "Family bakery", keywords: [] },
	],
	"seo.generate-meta-batch": [
		{ siteName: "Kedai Batik", keywords: ["batik"], items: [{ id: "products:1", type: "product", itemName: "Batik Scarf", context: "Silk" }] },
		{ siteName: "Kuih Mak Teh", keywords: [], items: [{ id: "pages:9", type: "page", itemName: "About" }, { id: "pages:10", type: "page", itemName: "Menu" }] },
	],
	"seo.fix-meta": [
		{ siteName: "Kedai Batik", pageContent: "Heading: Welcome" },
		{ siteName: "Kuih Mak Teh", pageContent: "Heading: Our story" },
	],
	"seo.blog-meta": [
		{ title: "Cách bảo quản vải batik", content: "Giặt tay bằng nước lạnh.", fallbackLanguage: "en" },
		{ title: "Kuih for Raya", content: "Five kuih to bake.", fallbackLanguage: "ms" },
	],
	"copy.blog-post": [
		{ prompt: "Caring for batik", language: "ms", tone: "Friendly" },
		{ prompt: "Kuih for Raya", language: "ms", tone: "Friendly" },
	],
	"i18n.translate-blocks": [
		{ targetLocale: "ms", fields: { headline: "Welcome" } },
		{ targetLocale: "ms", fields: { "faq.items.0.question": "Do you ship?" } },
	],
	"i18n.translate-product-field": [
		{ text: "Silk scarf", format: "plain", sourceLocale: "en", targetLocale: "ms-MY" },
		{ text: "Woven basket", format: "plain", sourceLocale: "en", targetLocale: "ms-MY" },
	],
	"catalog.bulk-parse-products": [
		{ promptText: "batik scarf RM50", locale: "ms", categoryCandidates: [{ id: 1, path: "Apparel > Scarves" }] },
		{ promptText: "rattan basket 30rm, merah", locale: "ms", categoryCandidates: [{ id: 1, path: "Apparel > Scarves" }] },
	],
	"copy.blog-post-draft": [
		{ title: "How to keep batik bright", outline: ["Washing", "Drying"], notes: "", language: "en", shopName: "Kedai Batik" },
		{ title: "Picking a silk scarf", outline: ["Weight", "Colour"], notes: "RM50", language: "en", shopName: "Kedai Batik" },
	],
	"catalog.split-products": [{ promptText: "batik scarf RM50, rattan basket 30rm" }, { promptText: "kopi 1kg RM40, teh tarik RM8" }],
	"site.extract-business-info": [{ pageText: "Kedai Batik — silk scarves" }, { pageText: "Kuih Mak Teh — family bakery" }],
	"sitegen.site-plan": composedSamples("You generate a website as JSON."),
	"sitegen.page-blocks": composedSamples("You generate one page of a website as JSON."),
	"sitegen.personalize": composedSamples("Personalize four fields. JSON only."),
	"sitegen.sample-products": composedSamples("You generate sample products. JSON only."),
	"sitegen.blog-seeds": composedSamples("You generate 3 blog post seeds. JSON only."),
	"sitegen.blog-post-content": composedSamples("You write blog post content. JSON only."),
	"sitegen.image-keywords": composedSamples("Return image keywords as JSON."),
	"i18n.translate-image-terms": composedSamples(""),
	"i18n.translate-user-input": composedSamples(""),
	"migration.pw1-native-design": [
		{
			system: "Design a storefront from existing PW2 blocks only.",
			user: '{"name":"Kedai Batik"}',
			choices: [{ blockType: "hero", variant: "centered", sourceIds: ["c1"] }],
			fontHeading: ["Inter"],
			fontBody: ["Inter"],
			navigationVariants: ["classic"],
			footerVariants: ["simple"],
			industryCategories: ["ecommerce"],
		},
		{
			system: "Design a storefront from existing PW2 blocks only.",
			user: '{"name":"Kuih Mak Teh"}',
			choices: [{ blockType: "carousel", variant: "cards", sourceIds: ["c9"] }],
			fontHeading: ["Lora"],
			fontBody: ["Lora", "Inter"],
			navigationVariants: ["centered"],
			footerVariants: ["minimal"],
			industryCategories: ["fnb"],
		},
	],
	"migration.pw1-brand-palette": [
		{ url: "https://kedaibatik.my", cssColors: [{ color: "#123456", score: 3, roles: ["cta"] }], hasWebsite: true, hasLogo: false, images: ["aGVsbG8="] },
		{ url: "https://kuih.my", cssColors: [], hasWebsite: false, hasLogo: true, images: ["d29ybGQ=", "Ynll"] },
	],
};

const ctxA: AiRequestContext = { organizationId: "org_a", tenantId: "1", userId: "usr_a", email: "a@shop.my", role: "owner", locale: "en-MY" };
const ctxB: AiRequestContext = { organizationId: "org_b", tenantId: "2", userId: "usr_b", email: "b@shop.vn", role: "editor", locale: "vi-VN" };

const instructionsFor = (id: AiTaskId, raw: unknown, ctx: AiRequestContext) => {
	const definition = TASK_DEFINITIONS[id] as { instructions: (input: unknown, ctx: AiRequestContext) => string };
	return definition.instructions(AI_TASKS[id].input.parse(raw), ctx);
};

describe("cache-stable task instructions [TC-AICP-33]", () => {
	it.each(AI_TASK_IDS)("%s: samples differ in every field outside the allowlist", (id) => {
		const [a, b] = SAMPLES[id] as [Record<string, unknown>, Record<string, unknown>];
		const stable = new Set<string>(CACHE_STABLE_FIELDS[id]);
		for (const key of Object.keys((AI_TASKS[id].input as unknown as ZodObject).shape)) {
			if (stable.has(key)) expect(a[key], `${id}.${key} must match`).toEqual(b[key]);
			else expect(JSON.stringify(a[key]), `${id}.${key} must differ (or be allowlisted)`).not.toBe(JSON.stringify(b[key]));
		}
	});

	it.each(AI_TASK_IDS)("%s: instructions are byte-identical across requests, orgs and users", (id) => {
		const [a, b] = SAMPLES[id];
		expect(instructionsFor(id, b, ctxB)).toBe(instructionsFor(id, a, ctxA));
	});
});
