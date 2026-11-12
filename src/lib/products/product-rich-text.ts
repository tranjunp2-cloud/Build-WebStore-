/**
 * Product descriptions are Lexical rich text in Payload. The copilot reads and writes simple markdown:
 * paragraphs, `#` headings, `-` bullets, `1.` numbered lists, `**bold**`, `*italic*` and links
 * `[text](url)` (http(s), mailto, tel or a relative path only).
 *
 * Writing a description rebuilds the whole document from the markdown, so anything markdown can't hold
 * would be lost: pictures (`upload`), blocks, quotes, tables, nested lists, links to a record. A description
 * that holds any of those is NOT editable by the copilot (`descriptionLockMessage` says why); callers must
 * refuse the change instead of dropping the content. Underline, strike-through and code marks are not kept
 * (the text is).
 */

const BOLD = 1;
const ITALIC = 2;

type LexicalNode = {
	type?: string;
	children?: LexicalNode[];
	text?: string;
	format?: number | string;
	tag?: string;
	listType?: string;
	/** link nodes (Payload): `{ linkType: "custom" | "internal", url, newTab }`; core Lexical links keep `url` on the node */
	fields?: { linkType?: string; url?: string };
	url?: string;
};
export type LexicalDoc = { root: LexicalNode & { type: "root" } };

const base = { direction: "ltr", format: "", indent: 0, version: 1 } as const;

function textNode(text: string, format: number) {
	return { type: "text", text, format, mode: "normal", style: "", detail: 0, version: 1 };
}

/** Links the copilot may write: web, mail, phone, or a path of the shop itself. Anything else (javascript:, data:, //host) stays text. */
export function isSafeLinkUrl(url: string): boolean {
	if (!url || url.length > 2000 || /[\s\u0000-\u001f]/.test(url)) return false;
	if (/^\/(?!\/)|^\.{1,2}\/|^#/.test(url)) return true;
	if (/^(mailto|tel):[^\s]+$/i.test(url)) return true;
	try {
		const parsed = new URL(url);
		return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
	} catch {
		return false;
	}
}

const linkNode = (url: string, children: unknown[]) => ({
	type: "link",
	...base,
	version: 3,
	fields: { linkType: "custom", newTab: false, url },
	children,
});

/** A link, or `**bold**` / `*italic*` / `***both***` (which may hold links); the leftmost token wins. */
const TOKEN = /(\[[^[\]\n]+\]\([^()\s]+\))|(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g;

/** Inline markdown into text and link nodes; everything else stays literal text. */
function inline(source: string, format = 0): unknown[] {
	const nodes: unknown[] = [];
	let last = 0;
	const text = (value: string, marks: number) => {
		if (value) nodes.push(textNode(value, marks));
	};
	for (const match of source.matchAll(TOKEN)) {
		const token = match[0];
		const index = match.index ?? 0;
		if (match[1]) {
			const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
			// a link to somewhere unsafe is kept as the literal text the author wrote
			if (!parts?.[1] || !parts[2] || !isSafeLinkUrl(parts[2])) continue;
			text(source.slice(last, index), format);
			nodes.push(linkNode(parts[2], inline(parts[1], format)));
		} else {
			text(source.slice(last, index), format);
			if (token.startsWith("***")) nodes.push(...inline(token.slice(3, -3), format | BOLD | ITALIC));
			else if (token.startsWith("**")) nodes.push(...inline(token.slice(2, -2), format | BOLD));
			else nodes.push(...inline(token.slice(1, -1), format | ITALIC));
		}
		last = index + token.length;
	}
	text(source.slice(last), format);
	return nodes;
}

const paragraph = (text: string) => ({ type: "paragraph", ...base, textFormat: 0, textStyle: "", children: inline(text) });

function list(items: string[], ordered: boolean) {
	return {
		type: "list",
		listType: ordered ? "number" : "bullet",
		tag: ordered ? "ol" : "ul",
		start: 1,
		...base,
		children: items.map((item, i) => ({ type: "listitem", value: i + 1, ...base, children: inline(item) })),
	};
}

export function markdownToLexical(markdown: string): LexicalDoc {
	const children: unknown[] = [];
	const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
	let buffer: string[] = [];
	let items: { ordered: boolean; text: string[] } | null = null;
	const flushText = () => {
		if (buffer.length > 0) children.push(paragraph(buffer.join(" ").trim()));
		buffer = [];
	};
	const flushList = () => {
		if (items) children.push(list(items.text, items.ordered));
		items = null;
	};
	for (const raw of lines) {
		const line = raw.trim();
		const heading = /^(#{1,6})\s+(.+)$/.exec(line);
		const bullet = /^[-*•]\s+(.+)$/.exec(line);
		const numbered = /^\d{1,3}[.)]\s+(.+)$/.exec(line);
		if (!line) {
			flushText();
			flushList();
		} else if (heading) {
			flushText();
			flushList();
			// the page title is the product name: description headings start at h2
			const level = Math.min(Math.max(heading[1].length, 2), 4);
			children.push({ type: "heading", tag: `h${level}`, ...base, children: inline(heading[2].trim()) });
		} else if (bullet || numbered) {
			flushText();
			const ordered = Boolean(numbered);
			if (items && items.ordered !== ordered) flushList();
			items = items ?? { ordered, text: [] };
			items.text.push((bullet?.[1] ?? numbered?.[1] ?? "").trim());
		} else {
			flushList();
			buffer.push(line);
		}
	}
	flushText();
	flushList();
	return { root: { type: "root", ...base, children: children as LexicalNode[] } };
}

/** The address of a link node, when it has one the copilot can write back. */
function linkUrl(node: LexicalNode): string | null {
	if (node.fields?.linkType === "internal") return null;
	const url = (node.fields?.url ?? node.url ?? "").trim();
	return url && isSafeLinkUrl(url) ? url : null;
}

/** Spaces and parentheses would end the markdown address early. */
const markdownUrl = (url: string) => url.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

/** Marks around a run of words; spaces at its edges stay outside, where markdown needs them. */
function markRun(text: string, format: number): string {
	const core = text.trim();
	const mark = (format & BOLD ? "**" : "") + (format & ITALIC ? "*" : "");
	if (!core || !mark) return text;
	const start = text.indexOf(core);
	return `${text.slice(0, start)}${mark}${core}${[...mark].reverse().join("")}${text.slice(start + core.length)}`;
}

/** Children of a paragraph, heading, list item or link: neighbouring text with the same marks reads as one run. */
function inlineChildren(nodes: LexicalNode[] | undefined): string {
	const out: string[] = [];
	let run: { text: string; format: number } | null = null;
	const flush = () => {
		if (run) out.push(markRun(run.text, run.format));
		run = null;
	};
	for (const node of nodes ?? []) {
		if (node.type === "text") {
			const format = typeof node.format === "number" ? node.format & (BOLD | ITALIC) : 0;
			if (run && run.format === format) run.text += node.text ?? "";
			else {
				flush();
				run = { text: node.text ?? "", format };
			}
		} else {
			flush();
			out.push(inlineMarkdown(node));
		}
	}
	flush();
	return out.join("");
}

function inlineMarkdown(node: LexicalNode): string {
	if (node.type === "text") return markRun(node.text ?? "", typeof node.format === "number" ? node.format & (BOLD | ITALIC) : 0);
	if (node.type === "linebreak") return " ";
	const inner = inlineChildren(node.children);
	if (node.type === "link" || node.type === "autolink") {
		const url = linkUrl(node);
		const label = inner.trim();
		if (!url) return inner;
		if (!label) return `[${url}](${markdownUrl(url)})`;
		// spaces around the words stay outside the brackets
		const at = inner.indexOf(label);
		return `${inner.slice(0, at)}[${label}](${markdownUrl(url)})${inner.slice(at + label.length)}`;
	}
	return inner;
}

const PICTURE_TYPES = new Set(["upload", "image"]);
const INLINE_TYPES = new Set(["text", "linebreak", "link", "autolink"]);

/**
 * Why the copilot can't rewrite this description: "pictures" when it holds uploaded pictures, "unsupported"
 * for anything else markdown can't carry; null when a write loses nothing. Plain strings and empty values are
 * always writable.
 */
export function descriptionBlocker(value: unknown): "pictures" | "unsupported" | null {
	const root = (value as LexicalDoc | null | undefined)?.root;
	if (!root || !Array.isArray(root.children)) return null;
	let found: "pictures" | "unsupported" | null = null;
	const flag = (kind: "pictures" | "unsupported") => {
		if (kind === "pictures" || found === null) found = kind;
	};
	const inlineNodes = (nodes: LexicalNode[] | undefined) => {
		for (const node of nodes ?? []) {
			const type = node.type ?? "";
			if (PICTURE_TYPES.has(type)) flag("pictures");
			else if (!INLINE_TYPES.has(type)) flag("unsupported");
			else if (type === "link" || type === "autolink") {
				// a link to a record, or to an address the copilot may not write, would be dropped
				const hasAddress = Boolean(node.fields?.url ?? node.url);
				if (node.fields?.linkType === "internal" || (hasAddress && !linkUrl(node))) flag("unsupported");
				inlineNodes(node.children);
			}
		}
	};
	for (const block of root.children) {
		const type = block.type ?? "";
		if (PICTURE_TYPES.has(type)) flag("pictures");
		else if (type === "paragraph" || type === "heading") inlineNodes(block.children);
		else if (type === "list") {
			if (block.listType !== "number" && block.listType !== "bullet") flag("unsupported");
			for (const item of block.children ?? []) {
				if (item.type !== "listitem") flag("unsupported");
				else inlineNodes(item.children);
			}
		} else flag("unsupported");
	}
	return found;
}

export const DESCRIPTION_HAS_PICTURES = "This description has pictures inside; change it in the product form.";
export const DESCRIPTION_UNSUPPORTED =
	"This description has formatting the assistant can't keep (tables, quotes, nested lists or special blocks); change it in the product form.";

/** The sentence to give the merchant (and the model) when a description can't be rewritten; null when it can. */
export function descriptionLockMessage(value: unknown): string | null {
	const blocker = descriptionBlocker(value);
	return blocker === "pictures" ? DESCRIPTION_HAS_PICTURES : blocker === "unsupported" ? DESCRIPTION_UNSUPPORTED : null;
}

/** The description as markdown; null for empty or non-Lexical values. */
export function lexicalToMarkdown(value: unknown): string | null {
	if (typeof value === "string") return value.trim() || null;
	const root = (value as LexicalDoc | null | undefined)?.root;
	if (!root || !Array.isArray(root.children)) return null;
	const blocks: string[] = [];
	for (const node of root.children) {
		if (node.type === "heading") {
			const level = Number(/^h(\d)$/.exec(node.tag ?? "")?.[1] ?? 2);
			blocks.push(`${"#".repeat(level)} ${inlineMarkdown(node).trim()}`);
		} else if (node.type === "list") {
			const ordered = node.listType === "number";
			blocks.push(
				(node.children ?? [])
					.map((item, i) => `${ordered ? `${i + 1}.` : "-"} ${inlineMarkdown(item).trim()}`)
					.join("\n"),
			);
		} else {
			const text = inlineMarkdown(node).trim();
			if (text) blocks.push(text);
		}
	}
	return blocks.join("\n\n").trim() || null;
}
