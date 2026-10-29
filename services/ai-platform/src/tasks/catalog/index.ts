import type { AiTaskId } from "@ech/ai-contracts";
import type { TaskDefinition } from "../task-definition";
import { CATALOG_BUILDER_TASK_DEFINITIONS } from "./catalog-builder-tasks";
import { productDescriptionTask, seoMetaTask, translateTask } from "./content-tasks";
import { COPY_TASK_DEFINITIONS } from "./copy-tasks";
import { I18N_TASK_DEFINITIONS } from "./i18n-tasks";
import { SEO_BLOG_TASK_DEFINITIONS } from "./seo-blog-tasks";
import { MIGRATION_TASK_DEFINITIONS } from "./migration-tasks";
import { SITEGEN_TASK_DEFINITIONS } from "./sitegen-tasks";

/** Every id in AI_TASKS must have a server definition (enforced by a spec). */
export const TASK_DEFINITIONS: { [K in AiTaskId]: TaskDefinition<K> } = {
	"content.product-description": productDescriptionTask,
	"content.translate": translateTask,
	"content.seo-meta": seoMetaTask,
	...COPY_TASK_DEFINITIONS,
	...SEO_BLOG_TASK_DEFINITIONS,
	...I18N_TASK_DEFINITIONS,
	...CATALOG_BUILDER_TASK_DEFINITIONS,
	...SITEGEN_TASK_DEFINITIONS,
	...MIGRATION_TASK_DEFINITIONS,
};
