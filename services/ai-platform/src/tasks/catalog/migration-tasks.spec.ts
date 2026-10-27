import { describe, expect, it } from "vitest";
import type { AiTaskInput } from "@ech/ai-contracts";
import { MIGRATION_TASK_DEFINITIONS } from "./migration-tasks";

// TC-AIMV-08: the PW1 design step only accepts the block/variant pairs its source component allows.
const design: AiTaskInput<"migration.pw1-native-design"> = {
	system: "Design the site.",
	user: "Source summary",
	choices: [
		{ blockType: "service-cards", variant: "grid", sourceIds: ["svc-1"] },
		{ blockType: "faq", variant: "accordion", sourceIds: ["faq-1"] },
	],
	fontHeading: ["Outfit"],
	fontBody: ["Inter"],
	navigationVariants: ["simple"],
	footerVariants: ["simple"],
	industryCategories: ["business"],
};

function validDocument(sections: unknown[]) {
	return {
		industry: { category: "business", confidence: "high", reason: "Consultancy" },
		theme: { primaryColor: "#112233", secondaryColor: "#445566", fontHeading: "Outfit", fontBody: "Inter" },
		navigationVariant: "simple",
		footerVariant: "simple",
		pages: [{ sourceId: "home", sections }],
	};
}

describe("migration.pw1-native-design output schema [TC-AIMV-08]", () => {
	const schema = MIGRATION_TASK_DEFINITIONS["migration.pw1-native-design"].modelOutput!(design);

	it("accepts a section whose block and variant match its source component", () => {
		const result = schema.safeParse(validDocument([{ sourceId: "svc-1", blockType: "service-cards", variant: "grid" }]));

		expect(result.success).toBe(true);
	});

	it("rejects a section whose blockType or variant is not allowed for its sourceId", () => {
		const wrongBlock = schema.safeParse(validDocument([{ sourceId: "svc-1", blockType: "faq", variant: "accordion" }]));
		const wrongPairing = schema.safeParse(validDocument([{ sourceId: "faq-1", blockType: "service-cards", variant: "grid" }]));
		const unknownSource = schema.safeParse(validDocument([{ sourceId: "other", blockType: "faq", variant: "accordion" }]));

		expect(wrongBlock.success).toBe(false);
		expect(wrongPairing.success).toBe(false);
		expect(unknownSource.success).toBe(false);
	});

	it("rejects extra keys on a section (strict objects)", () => {
		const result = schema.safeParse(validDocument([{ sourceId: "svc-1", blockType: "service-cards", variant: "grid", html: "<img>" }]));

		expect(result.success).toBe(false);
	});

	it("limits the theme to hex colours and the offered font choices", () => {
		const doc = validDocument([]);
		const badColor = schema.safeParse({ ...doc, theme: { ...doc.theme, primaryColor: "url(x)" } });
		const badFont = schema.safeParse({ ...doc, theme: { ...doc.theme, fontHeading: "Comic Sans" } });

		expect(badColor.success).toBe(false);
		expect(badFont.success).toBe(false);
	});
});

describe("migration.pw1-brand-palette prompt [TC-AIMV-08]", () => {
	it("sends the CSS evidence as JSON text followed by the screenshots at low detail", () => {
		const definition = MIGRATION_TASK_DEFINITIONS["migration.pw1-brand-palette"];
		const input = {
			url: "https://kedai.example",
			cssColors: [{ color: "#0f766e", score: 9, roles: ["background"] }],
			hasWebsite: true,
			hasLogo: false,
			images: ["AAAA"],
		};

		const messages = definition.prompt(input) as Array<{ role: string; content: Array<Record<string, unknown>> }>;

		expect(messages[0]!.role).toBe("user");
		expect(JSON.parse(String(messages[0]!.content[0]!.text))).toMatchObject({ cssColors: input.cssColors, hasWebsite: true });
		expect(messages[0]!.content[1]).toMatchObject({ type: "image", providerOptions: { openai: { imageDetail: "low" } } });
	});
});
