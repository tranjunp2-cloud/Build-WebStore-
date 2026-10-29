import { z } from "zod";

/**
 * PW1 → PW2 website migration (prime-web `lib/migration/*`, CLI-only).
 * The design step's structured output is constrained per source store: the
 * platform builds the strict schema from the allowed choices listed here, and
 * prime-web still binds and validates every block against its registry.
 */
const Identifier = z.string().min(1).max(200);

export const Pw1NativeDesignInputSchema = z.object({
	/** prime-web's design instructions (block catalogue rules, untrusted-source warning). */
	system: z.string().min(1).max(40_000),
	/** The source contract summary (untrusted public website content) + any validation correction. */
	user: z.string().min(1).max(200_000),
	/** Block/variant pairs each source component may become, with the component ids allowed to pick it. */
	choices: z
		.array(z.object({ blockType: Identifier, variant: Identifier, sourceIds: z.array(Identifier).min(1).max(500) }))
		.min(1)
		.max(100),
	fontHeading: z.array(Identifier).min(1).max(100),
	fontBody: z.array(Identifier).min(1).max(100),
	navigationVariants: z.array(Identifier).min(1).max(50),
	footerVariants: z.array(Identifier).min(1).max(50),
	industryCategories: z.array(Identifier).min(1).max(50),
});
/** Shape checked in prime-web (`bindNativeDesign`); the platform only guarantees the strict schema. */
export const Pw1NativeDesignOutputSchema = z.record(z.string(), z.unknown());

export const Pw1BrandPaletteInputSchema = z.object({
	url: z.string().max(2_000),
	/** CSS colours observed on the source page ({ color, score, roles }), most prominent first. */
	cssColors: z
		.array(z.object({ color: z.string().max(40), score: z.number(), roles: z.array(z.string().max(60)).max(20) }))
		.max(40)
		.default([]),
	hasWebsite: z.boolean(),
	hasLogo: z.boolean(),
	/** Base64 JPEG screenshots: the website first (when present), the logo last. */
	images: z.array(z.string().min(1).max(12_000_000)).min(1).max(2),
});
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const Pw1BrandPaletteOutputSchema = z
	.object({
		usable: z.boolean(),
		primaryColor: Hex,
		secondaryColor: Hex,
		reason: z.string(),
		confidence: z.enum(["low", "medium", "high"]),
	})
	.strict();

export const MIGRATION_TASKS = {
	"migration.pw1-native-design": { input: Pw1NativeDesignInputSchema, output: Pw1NativeDesignOutputSchema },
	"migration.pw1-brand-palette": { input: Pw1BrandPaletteInputSchema, output: Pw1BrandPaletteOutputSchema },
} as const;
