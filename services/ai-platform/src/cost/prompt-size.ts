import { asSchema, type ToolSet } from "ai";
import type { Capability } from "../config/capabilities";
import { capabilitySet } from "../agent/merchant-capabilities";
import { merchantInstructions } from "../agent/merchant-instructions";
import { createMerchantTools, type MerchantToolDeps } from "../agent/merchant-tools";

/**
 * Size of the copilot's static prefix (system instructions + tool definitions) for a
 * capability set, optionally narrowed to the tools one routing variant sends. Used by
 * `scripts/measure-prompt.mjs` and the routing specs; never on the request path.
 */

/** Rough tokens for English text / JSON schemas (≈4 characters per token). */
export const estimateTokens = (chars: number) => Math.round(chars / 4);

export interface ToolSize {
	name: string;
	chars: number;
}

export interface PrefixSize {
	instructionsChars: number;
	tools: ToolSize[];
	toolChars: number;
	totalChars: number;
}

const noop = async () => ({});

/** Deps that never run: only the definitions (description + schema) are read. */
export const NO_DEPS: MerchantToolDeps = {
	runId: "run_measure",
	newChangeSetId: () => "cs_measure",
	now: () => new Date(0),
	stage: async () => undefined,
	productKnowledge: async () => ({ merchantText: "", images: [] }),
	images: () => [],
	findImages: async () => [],
	generateImages: noop,
	inventoryRead: noop,
	inventoryPrepare: async () => ({ error: null }),
	productPrepare: async () => ({ error: null }),
	productPreparePublish: async () => ({ error: null }),
	snapshot: async () => ({ error: null }),
	allowEdit: () => true,
	seenProducts: () => [],
	readItem: noop,
	searchItems: noop,
	currentPage: noop,
	createdInChat: () => [],
	siteRead: noop,
	sitePrepare: async () => ({ error: null }),
	storeCategories: noop,
	storeDiscounts: noop,
	storeCustomers: noop,
};

/** One tool as an OpenAI-style function definition (what a provider receives). */
export async function toolDefinitionChars(name: string, tool: ToolSet[string]): Promise<number> {
	const t = tool as { description?: string; inputSchema: Parameters<typeof asSchema>[0] };
	const parameters = await asSchema(t.inputSchema).jsonSchema;
	return JSON.stringify({ type: "function", function: { name, description: t.description ?? "", parameters } }).length;
}

export async function toolSizes(tools: ToolSet, only?: readonly string[]): Promise<ToolSize[]> {
	const names = Object.keys(tools).filter((name) => !only || only.includes(name));
	return Promise.all(names.map(async (name) => ({ name, chars: await toolDefinitionChars(name, tools[name] as ToolSet[string]) })));
}

/** The prefix of one request: `instructions` override the set's default text (routing variants). */
export async function prefixSize(caps: readonly Capability[], options: { only?: readonly string[]; instructions?: string; extraTools?: ToolSet } = {}): Promise<PrefixSize> {
	const set = capabilitySet(caps);
	const tools = { ...(createMerchantTools(NO_DEPS, set) as ToolSet), ...(options.extraTools ?? {}) };
	const instructions = options.instructions ?? merchantInstructions(set);
	const sizes = await toolSizes(tools, options.only);
	const toolChars = sizes.reduce((sum, t) => sum + t.chars, 0);
	return { instructionsChars: instructions.length, tools: sizes, toolChars, totalChars: instructions.length + toolChars };
}

export const STAGING_SMALL: readonly Capability[] = ["site", "blog", "stock_photos"];
export const STAGING_FULL: readonly Capability[] = [
	"site",
	"blog",
	"stock_photos",
	"media_library",
	"image_generation",
	"shop_products",
	"store_categories",
	"store_discounts",
	"store_customers",
	"campaigns",
	"store_orders",
	"store_reports",
];
