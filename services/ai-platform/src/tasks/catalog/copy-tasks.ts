import type { COPY_TASKS } from "@ech/ai-contracts";
import { defineTask, type TaskDefinition } from "../task-definition";
import { localeDisplayName } from "./i18n-tasks";

/** Prompts ported from prime-web /api/ai/product-description and /api/ai/rewrite-text. */
export const COPY_TASK_DEFINITIONS: { [K in keyof typeof COPY_TASKS]: TaskDefinition<K> } = {
	"copy.product-description": defineTask({
		id: "copy.product-description",
		alias: "fast",
		promptVersion: "copy-product-description@1",
		temperature: 0.7,
		maxOutputTokens: 800,
		instructions: (input) => `You are a professional conversion-focused e-commerce copywriter for the Malaysian market.
Your task is to write a highly engaging, persuasive, and professional product description.

The output MUST be in ${input.language === "ms" ? "Bahasa Melayu (Malay)" : "English"}.

Return the description in the "description" field: the full product description in plain text ONLY. Write 3-4 paragraphs highlighting the key benefits, features, and why the customer needs this. DO NOT include any HTML tags or markdown formatting. Use simple newlines to separate paragraphs. Ensure the tone is persuasive and professional.

RULES:
1. Keep it structured and easy to read.
2. Focus on the benefits of the product.
3. Be persuasive but honest.
4. Do NOT include store/brand names unless provided.
5. NO HTML TAGS WHATSOEVER. Return pure plain text only.`,
		prompt: (input) => `Write a product description for this product:
Product Name: "${input.name}"${input.category ? ` in the "${input.category}" category` : ""}`,
	}),
	"copy.rewrite-text": defineTask({
		id: "copy.rewrite-text",
		alias: "fast",
		promptVersion: "copy-rewrite-text@1",
		temperature: 0.7,
		maxOutputTokens: 500,
		instructions: (input) => `You are a professional copywriter. Rewrite the given text based on the instruction.

RULES:
1. Return only the rewritten text in the "rewritten" field, no explanation
2. Keep the same language as the original (${localeDisplayName(input.language ?? "en")})
3. Maintain the same general meaning unless instructed otherwise
4. Keep it concise and professional
${input.context ? `5. Context: This text is for a ${input.context} section of a website` : ""}`.trimEnd(),
		prompt: (input) => `Original text: "${input.text}"\n\nInstruction: ${input.instruction}`,
	}),
};
