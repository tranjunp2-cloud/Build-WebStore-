import { z } from "zod";
import { defineTask, NO_INVENTED_FACTS } from "../task-definition";

export const productDescriptionTask = defineTask({
	id: "content.product-description",
	alias: "balanced",
	promptVersion: "product-description@1",
	instructions: (input) =>
		[
			"Task: content.product-description",
			"You write e-commerce product descriptions for Southeast Asian online sellers.",
			`Write in locale ${input.locale}. Tone: ${input.tone ?? "neutral"}. At most ${input.maxWords ?? 160} words.`,
			"Return a plain-text description (no markdown, no HTML) and up to 6 short highlight bullets.",
			NO_INVENTED_FACTS,
		].join("\n"),
	prompt: (input) =>
		[`Product: ${input.productName}`, ...(input.facts ?? []).map((fact) => `- ${fact}`)].join("\n"),
});

export const translateTask = defineTask({
	id: "content.translate",
	alias: "fast",
	// @2: the per-request glossary moved from the instructions to the prompt (cache-stable system prompt).
	promptVersion: "translate@2",
	instructions: (input) =>
		[
			"Task: content.translate",
			`Translate every value of the JSON object into locale ${input.targetLocale}${input.sourceLocale ? ` from ${input.sourceLocale}` : ""}.`,
			"Keep the same keys. Keep numbers, units, SKUs, URLs and HTML tags unchanged. Natural, idiomatic e-commerce copy.",
		].join("\n"),
	prompt: (input) =>
		[input.glossary?.length ? `Never translate these terms: ${input.glossary.join(", ")}.` : "", JSON.stringify(input.fields)]
			.filter(Boolean)
			.join("\n\n"),
	// Strict structured output rejects records: pin the exact keys the caller sent.
	modelOutput: (input) =>
		z.object({ fields: z.object(Object.fromEntries(Object.keys(input.fields).map((key) => [key, z.string()]))) }),
});

export const seoMetaTask = defineTask({
	id: "content.seo-meta",
	alias: "fast",
	promptVersion: "seo-meta@1",
	instructions: (input) =>
		[
			"Task: content.seo-meta",
			`Write an SEO meta title (≤60 characters) and meta description (≤160 characters) in locale ${input.locale}.`,
			"Use the page's own wording; include a keyword only if it fits naturally. No clickbait, no emojis.",
			NO_INVENTED_FACTS,
		].join("\n"),
	prompt: (input) =>
		[
			`Title: ${input.title}`,
			input.keywords?.length ? `Keywords: ${input.keywords.join(", ")}` : "",
			input.body ? `Content:\n${input.body.slice(0, 6000)}` : "",
		]
			.filter(Boolean)
			.join("\n"),
});
