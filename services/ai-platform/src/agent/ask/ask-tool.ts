import { tool } from "ai";
import { z } from "zod";

/**
 * `ask_user` — the copilot's clarifying-question tool. It has no `execute`:
 * calling it ends the model's turn, the run pauses (`awaiting_input`) and the
 * merchant answers in a question card; their answers come back as this call's
 * tool result and the same run continues.
 *
 * For a product the model only says what it knows; the platform builds the
 * questions itself from the shop's data (family → that family's required
 * attributes → variants) and a decision model answers what it is sure of.
 */
export const ASK_USER_TOOL = "ask_user";

export const MAX_SHOWN_QUESTIONS = 3;

const FactSchema = z.object({
	name: z.string().min(1).max(80).describe('What the fact is about, e.g. "material", "fit", "colour"'),
	value: z.string().min(1).max(300).describe("The value exactly as the merchant gave it or as it reads in their files"),
});

const VariantAxisSchema = z.object({
	axis: z.enum(["color", "size", "other"]),
	label: z.string().min(1).max(40).describe('Axis name shown to the merchant, e.g. "Colour", "Size"'),
	values: z.array(z.string().min(1).max(60)).min(1).max(30),
});

const PICTURES_DESCRIPTION =
	"Set to let the merchant pick or upload photos in the card (options are filled for you). Never ask them to describe photos in words.";

const PICTURE_SOURCES = ["stock", "library", "both"] as const;
type PictureSource = (typeof PICTURE_SOURCES)[number];

const picturesSchema = (sources: readonly [PictureSource, ...PictureSource[]]) =>
	z
		.object({
			query: z.string().min(2).max(80).describe("Short search words for the photos, e.g. \"linen shirt on hanger\""),
			source: z.enum(sources),
		})
		.nullable()
		.describe(PICTURES_DESCRIPTION);

const customQuestionSchema = (pictures: ReturnType<typeof picturesSchema>) =>
	z.object({
		id: z.string().min(1).max(40).describe("snake_case id"),
		title: z.string().min(1).max(160),
		why: z.string().max(200).nullable().describe("One line on why the answer matters"),
		options: z
			.array(z.object({ value: z.string().min(1).max(80), label: z.string().min(1).max(120) }))
			.max(6)
			.describe("2–6 concrete options; empty to ask for free text"),
		multiple: z.boolean(),
		pictures,
	});

const userInputSchema = (question: ReturnType<typeof customQuestionSchema>) =>
	z.object({
		purpose: z
			.enum(["product_details", "custom"])
			.describe('"product_details" before drafting a product; "custom" for anything else (blog angle, audience…)'),
		product: z
			.object({
				name: z.string().min(1).max(200).describe("Working product name"),
				facts: z.array(FactSchema).max(30).describe("Everything the merchant stated or their files show — never guesses"),
				variants: z
					.enum(["none", "unknown", "listed"])
					.describe('"listed" when the merchant named the options (colours, sizes); "none" for a single product'),
				variantAxes: z.array(VariantAxisSchema).max(3).describe('Required when variants is "listed"'),
			})
			.nullable()
			.describe('Required for "product_details"'),
		questions: z.array(question).max(MAX_SHOWN_QUESTIONS).describe('Only for "custom": at most 3 questions'),
		language: z
			.enum(["en", "ms", "vi"])
			.nullable()
			// optional: a call without it must still ask (the UI locale is used)
			.optional()
			.describe("The language the merchant writes in (en English, ms Bahasa Melayu, vi Vietnamese): the card's own words follow it. Write your questions in it too."),
	});

export const AskUserInputSchema = userInputSchema(customQuestionSchema(picturesSchema(PICTURE_SOURCES)));
export type AskUserInput = z.infer<typeof AskUserInputSchema>;

const ASK_DESCRIPTION_HEAD = "Ask the merchant before drafting.";
const ASK_DESCRIPTION_TAIL =
	"Do not ask what the merchant already told you, and ask once per request: the answers come back in this call's result.";

export const askUserTool = tool({
	description: `${ASK_DESCRIPTION_HEAD} For a new product call it with purpose "product_details" and everything you know — the platform asks for the family, its required attributes and variants from the shop's own catalog. For other clarifications use purpose "custom" with at most 3 questions. ${ASK_DESCRIPTION_TAIL}`,
	inputSchema: AskUserInputSchema,
});

/** What this deployment lets `ask_user` do (a capability set decides it). */
export interface AskUserOptions {
	/** "product_details": the family / attributes / variants flow on Product Master */
	productDetails: boolean;
	/** photo sources a "custom" question may offer; none = no photo questions */
	pictureSources: ReadonlyArray<"stock" | "library">;
}

const FULL_OPTIONS: AskUserOptions = { productDetails: true, pictureSources: ["stock", "library"] };

const isFull = (options: AskUserOptions) =>
	options.productDetails && options.pictureSources.includes("stock") && options.pictureSources.includes("library");

/**
 * ask_user narrowed to what a deployment offers: without Product Master the
 * "product_details" purpose does not exist; photo questions only offer the
 * sources the deployment has. The full options give back the original tool.
 * The narrowed schema is a strict subset of AskUserInputSchema, so the same
 * parse and flow code handle both (hence the casts).
 */
export function askUserInputSchemaFor(options: AskUserOptions = FULL_OPTIONS): typeof AskUserInputSchema {
	if (isFull(options)) return AskUserInputSchema;
	const { pictureSources } = options;
	const both = pictureSources.includes("stock") && pictureSources.includes("library");
	const sources: [PictureSource, ...PictureSource[]] | null = both
		? ["stock", "library", "both"]
		: pictureSources.length === 1
			? [pictureSources[0] as PictureSource]
			: null;
	const pictures = sources
		? picturesSchema(sources)
		: (z.null().describe("Always null here: photo questions are not available.") as unknown as ReturnType<typeof picturesSchema>);
	const narrowed = userInputSchema(customQuestionSchema(pictures));
	if (options.productDetails) return narrowed;
	return narrowed.extend({
		purpose: z.enum(["custom"]).describe('Always "custom"'),
		product: z.null().describe("Always null here: products cannot be drafted from the chat."),
	}) as unknown as typeof AskUserInputSchema;
}

export function askUserToolFor(options: AskUserOptions = FULL_OPTIONS): typeof askUserTool {
	if (isFull(options)) return askUserTool;
	return tool({
		description: options.productDetails
			? askUserTool.description
			: `${ASK_DESCRIPTION_HEAD} Use purpose "custom" with at most 3 questions. ${ASK_DESCRIPTION_TAIL}`,
		inputSchema: askUserInputSchemaFor(options),
	});
}
