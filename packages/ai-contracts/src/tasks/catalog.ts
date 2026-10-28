import type { z } from "zod";
import { CATALOG_BUILDER_TASKS } from "./catalog-builder";
import {
	ProductDescriptionInputSchema,
	ProductDescriptionOutputSchema,
	SeoMetaInputSchema,
	SeoMetaOutputSchema,
	TranslateInputSchema,
	TranslateOutputSchema,
} from "./content";
import { COPY_TASKS } from "./copy";
import { I18N_TASKS } from "./i18n";
import { SEO_BLOG_TASKS } from "./seo-blog";
import { MIGRATION_TASKS } from "./migration";
import { SITEGEN_TASKS } from "./sitegen";

/**
 * The task catalog — every AI capability callers may invoke by id. Callers
 * never pick a model; the platform maps each task to a model alias, prompt
 * version, quota and ledger entry.
 */
export const AI_TASKS = {
	"content.product-description": { input: ProductDescriptionInputSchema, output: ProductDescriptionOutputSchema },
	"content.translate": { input: TranslateInputSchema, output: TranslateOutputSchema },
	"content.seo-meta": { input: SeoMetaInputSchema, output: SeoMetaOutputSchema },
	...COPY_TASKS,
	...SEO_BLOG_TASKS,
	...I18N_TASKS,
	...CATALOG_BUILDER_TASKS,
	...SITEGEN_TASKS,
	...MIGRATION_TASKS,
} as const;

export type AiTaskId = keyof typeof AI_TASKS;
export const AI_TASK_IDS = Object.keys(AI_TASKS) as AiTaskId[];
export type AiTaskInput<T extends AiTaskId> = z.input<(typeof AI_TASKS)[T]["input"]>;
export type AiTaskOutput<T extends AiTaskId> = z.output<(typeof AI_TASKS)[T]["output"]>;

export function isAiTaskId(value: string): value is AiTaskId {
	return Object.hasOwn(AI_TASKS, value);
}
