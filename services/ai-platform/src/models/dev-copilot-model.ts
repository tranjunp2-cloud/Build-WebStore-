import { MockLanguageModelV4 } from "ai/test";

/**
 * Deterministic stand-in for local development without provider keys
 * (`AI_MODEL_BALANCED=mock:copilot`). It exercises the real tool/stage/approve
 * path end to end; content is templated, not generated. Refused in production
 * by the model registry.
 */

type PromptMessage = { role: string; content: unknown };

const usage = {
	inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 0, text: 0, reasoning: undefined },
};

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : ""))
		.join(" ");
}

function productNames(request: string): string[] {
	const list = request.includes(":") ? request.slice(request.indexOf(":") + 1) : "";
	const names = list
		.split(/[,;\n]/)
		.map((name) => name.trim())
		.filter((name) => name.length >= 2)
		.slice(0, 10);
	return names.length > 0 ? names : ["New product"];
}

function blogTopic(request: string): string {
	const match = request.match(/(?:about|về|tentang)\s+(.+)/i);
	const topic = (match?.[1] ?? request).replace(/[.?!]+$/, "").trim();
	return topic.charAt(0).toUpperCase() + topic.slice(1, 120);
}

function toolCall(name: string, input: unknown) {
	return {
		content: [{ type: "tool-call" as const, toolCallId: `dev_${Date.now()}`, toolName: name, input: JSON.stringify(input) }],
		finishReason: { unified: "tool-calls" as const, raw: undefined },
		usage,
		warnings: [],
	};
}

function text(answer: string) {
	return { content: [{ type: "text" as const, text: answer }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
}

/** Deterministic JSON for task-engine calls (instructions start with "Task: <id>"). */
function taskAnswer(system: string, request: string) {
	const task = system.match(/^Task: ([a-z.-]+)/m)?.[1];
	if (task === "content.translate") {
		const locale = system.match(/into locale ([A-Za-z-]+)/)?.[1] ?? "xx";
		let fields: Record<string, string> = {};
		try {
			fields = JSON.parse(request) as Record<string, string>;
		} catch {
			fields = {};
		}
		return text(JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `[${locale}] ${v}`])) }));
	}
	if (task === "content.product-description") {
		const name = request.split("\n")[0]?.replace(/^Product:\s*/, "") ?? "Product";
		return text(JSON.stringify({ description: `${name} — templated description from the local dev model.`, highlights: ["Dev model output"] }));
	}
	if (task === "content.seo-meta") {
		const title = request.split("\n")[0]?.replace(/^Title:\s*/, "").slice(0, 60) || "Page";
		return text(JSON.stringify({ metaTitle: title, metaDescription: `About ${title.toLowerCase()} — dev model meta description.` }));
	}
	return null;
}

export function createDevCopilotModel() {
	return new MockLanguageModelV4({
		modelId: "dev-copilot",
		doGenerate: async (options) => {
			const messages = options.prompt as PromptMessage[];
			const system = textOf(messages.find((m) => m.role === "system")?.content);
			const task = taskAnswer(system, textOf([...messages].reverse().find((m) => m.role === "user")?.content).trim());
			if (task) return task;
			if (messages.some((m) => m.role === "tool")) {
				return text("[dev model] Draft staged — review and approve it below.");
			}
			const request = textOf([...messages].reverse().find((m) => m.role === "user")?.content).trim();
			if (/\b(blog|post|article|bài viết|bài blog|artikel)\b/i.test(request)) {
				const topic = blogTopic(request);
				const paragraph = `This is a templated draft about ${topic.toLowerCase()} produced by the local dev model. Replace it with real content or switch AI_MODEL_BALANCED to a real provider.`;
				return toolCall("propose_blog_post", {
					locale: "en",
					title: topic.length >= 5 ? topic : `Notes on ${topic}`,
					contentHtml: `<h2>${topic}</h2><p>${paragraph}</p><h3>Key points</h3><ul><li>Point one</li><li>Point two</li></ul><p>${paragraph}</p>`,
					seoTitle: topic.slice(0, 60).padEnd(5, "."),
					seoDescription: `A short guide about ${topic.toLowerCase()}.`.slice(0, 160).padEnd(20, "."),
				});
			}
			if (/\b(product|products|sản phẩm|produk)\b/i.test(request)) {
				return toolCall("propose_product_drafts", {
					locale: "en-US",
					products: productNames(request).map((name) => ({
						name,
						description: `${name} — draft description from the local dev model. Edit before publishing.`,
					})),
				});
			}
			return text("[dev model] Right now I can draft new products and blog posts — e.g. “Create draft products: Batik scarf, Silk tudung”.");
		},
	});
}
