import "server-only";

import type { Payload } from "payload";

/**
 * Read-only views of the shop's own content for the copilot (answer about, review, find): blog posts.
 * (Store products are read by `store-product-tools.ts`.) Every view is trimmed for the model: ids, titles,
 * label/value facts and a bounded text. Merchant data only; nothing here touches buyers.
 */

export type ItemKind = "product" | "blog_post";

export interface ItemDetail {
	kind: ItemKind;
	id: string;
	title: string;
	status?: string;
	url?: string;
	facts: Array<{ label: string; value: string }>;
	text?: string;
	lists?: Array<{ label: string; items: string[] }>;
	/** pictures of the item, for the chat to show (never sent to the model) */
	media?: Array<{ url: string; alt?: string; label?: string }>;
	updatedAt?: string;
}

export interface ItemSummary {
	kind: ItemKind;
	id: string;
	title: string;
	status?: string;
	meta?: string;
	updatedAt?: string;
}

export const TEXT_LIMIT = 6_000;
const FACTS_LIMIT = 60;
const MEDIA_LIMIT = 8;

/** Only pictures the dashboard can load: same-origin paths or https. */
function safePictureUrl(url: unknown): string | null {
	if (typeof url !== "string" || !url) return null;
	if (/^\/(?!\/)/.test(url) || /^https:\/\//.test(url)) return url;
	return process.env.NODE_ENV !== "production" && /^http:\/\/localhost[:/]/.test(url) ? url : null;
}

/** Like `clip`, but paragraphs stay on their own lines. */
export function clipText(value: string, max: number): string {
	const text = value
		.replace(/[^\S\n]+/g, " ")
		.replace(/ *\n[\s]*/g, "\n")
		.trim();
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function clip(value: string, max: number): string {
	const text = value.replace(/\s+/g, " ").trim();
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Pictures inside a post body: Lexical upload nodes (populated at depth ≥ 1) or <img> tags. */
export function postPictures(content: unknown): Array<{ url: string; alt?: string }> {
	const out: Array<{ url: string; alt?: string }> = [];
	if (typeof content === "string") {
		for (const m of content.matchAll(/<img\b[^>]*>/gi)) {
			const src = safePictureUrl(/\ssrc="([^"]+)"/i.exec(m[0])?.[1]);
			const alt = /\salt="([^"]*)"/i.exec(m[0])?.[1];
			if (src) out.push({ url: src, ...(alt ? { alt } : {}) });
		}
		return out;
	}
	const walk = (node: unknown) => {
		if (!node || typeof node !== "object" || out.length >= MEDIA_LIMIT) return;
		if (Array.isArray(node)) return node.forEach(walk);
		const record = node as Record<string, unknown>;
		if (record.type === "upload" && record.value && typeof record.value === "object") {
			const value = record.value as { url?: unknown; alt?: unknown };
			const url = safePictureUrl(value.url);
			if (url) out.push({ url, ...(typeof value.alt === "string" && value.alt ? { alt: value.alt } : {}) });
		}
		walk(record.children ?? (record.root as Record<string, unknown> | undefined)?.children);
	};
	walk(content);
	return out;
}

/** Plain text of a post body: HTML string or Payload rich text (Lexical / Slate JSON). */
export function postText(content: unknown): { text: string; headings: string[] } {
	const headings: string[] = [];
	if (typeof content === "string") {
		for (const m of content.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)) headings.push(clip((m[1] ?? "").replace(/<[^>]+>/g, ""), 120));
		const text = content
			.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
			.replace(/<h([23])[^>]*>/gi, (_m, level: string) => `\n${"#".repeat(Number(level))} `)
			.replace(/<\/(p|h[1-6]|li|div)>|<br\s*\/?>/gi, "\n")
			// inline tags (<strong>, <code>, <a>) sit inside words: drop them without a space
			.replace(/<[^>]+>/g, "")
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&");
		return { text, headings };
	}
	// sibling text nodes are runs of one paragraph (bold, code, links): join them as written
	const parts: string[] = [];
	const walk = (node: unknown) => {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) return node.forEach(walk);
		const record = node as Record<string, unknown>;
		if (typeof record.text === "string") parts.push(record.text);
		const children = record.children ?? (record.root as Record<string, unknown> | undefined)?.children;
		const heading = /^h[23]$|^heading$/.test(String(record.type ?? record.tag ?? ""));
		if (heading) parts.push(`\n${String(record.tag ?? "h2") === "h3" ? "###" : "##"} `);
		if (heading && Array.isArray(children)) {
			headings.push(
				clip(
					children
						.map((c) => (c as { text?: string }).text ?? "")
						.join(""),
					120,
				),
			);
		}
		if (children) {
			walk(children);
			if (!/^(link|autolink)$/.test(String(record.type ?? ""))) parts.push("\n");
		}
	};
	walk(content);
	return { text: parts.join(""), headings };
}

interface BlogDoc {
	id: number | string;
	title?: string;
	slug?: string;
	status?: string;
	content?: unknown;
	publishedAt?: string | null;
	updatedAt?: string;
	category?: { name?: string; title?: string } | number | string | null;
	thumbnail?: { url?: string | null; alt?: string | null } | number | string | null;
	seo?: { metaTitle?: string | null; metaDescription?: string | null } | null;
}

type PayloadLike = Pick<Payload, "find">;
type FindArgs = Parameters<Payload["find"]>[0];

/** The workspace's posts, read as the merchant (Payload access) and pinned to this workspace. */
function tenantWhere(tenantId: string, extra: Record<string, unknown>[] = []) {
	return { and: [{ tenant: { equals: Number.isNaN(Number(tenantId)) ? tenantId : Number(tenantId) } }, ...extra] };
}

export async function searchPosts(
	payload: PayloadLike,
	user: unknown,
	tenantId: string,
	input: { query?: string; status?: string; limit?: number },
): Promise<{ total: number; items: ItemSummary[] }> {
	const filters: Record<string, unknown>[] = [];
	if (input.query) filters.push({ title: { like: input.query } });
	const trashed = input.status === "trash";
	if (trashed) filters.push({ deletedAt: { exists: true } });
	else if (input.status && input.status !== "any") filters.push({ status: { equals: input.status } });
	const result = await payload.find({
		collection: "blogs",
		where: tenantWhere(tenantId, filters),
		...(trashed ? { trash: true } : {}),
		limit: Math.min(input.limit ?? 10, 10),
		sort: "-updatedAt",
		depth: 0,
		overrideAccess: false,
		user,
		select: { title: true, slug: true, status: true, publishedAt: true, updatedAt: true },
	} as FindArgs);
	return {
		total: result.totalDocs,
		items: (result.docs as unknown as BlogDoc[]).map((doc) => ({
			kind: "blog_post",
			id: String(doc.id),
			title: doc.title ?? "(untitled)",
			status: doc.status,
			meta: [doc.slug ? `/blog/${doc.slug}` : null, doc.publishedAt ? `published ${doc.publishedAt.slice(0, 10)}` : null]
				.filter(Boolean)
				.join(" · "),
			updatedAt: doc.updatedAt,
		})),
	};
}

export async function readPost(payload: PayloadLike, user: unknown, tenantId: string, id: string): Promise<ItemDetail | null> {
	const result = await payload.find({
		collection: "blogs",
		where: tenantWhere(tenantId, [{ id: { equals: Number.isNaN(Number(id)) ? id : Number(id) } }]),
		limit: 1,
		depth: 1,
		overrideAccess: false,
		user,
	} as FindArgs);
	const doc = result.docs[0] as unknown as BlogDoc | undefined;
	if (!doc) return null;
	const { text, headings } = postText(doc.content);
	const words = text.split(/\s+/).filter(Boolean).length;
	const category = typeof doc.category === "object" && doc.category ? (doc.category.name ?? doc.category.title) : undefined;
	const thumbnail = typeof doc.thumbnail === "object" && doc.thumbnail ? doc.thumbnail : null;
	const coverUrl = safePictureUrl(thumbnail?.url);
	const media = [
		...(coverUrl ? [{ url: coverUrl, ...(thumbnail?.alt ? { alt: thumbnail.alt } : {}), label: "Cover" }] : []),
		...postPictures(doc.content),
	];
	const facts = [
		{ label: "Status", value: doc.status ?? "" },
		{ label: "Slug", value: doc.slug ?? "" },
		{ label: "Words", value: String(words) },
		{ label: "Category", value: category ?? "none" },
		{ label: "Cover image", value: thumbnail ? (thumbnail.alt ? `yes — alt "${thumbnail.alt}"` : "yes — no alt text") : "none" },
		{ label: "Meta title", value: doc.seo?.metaTitle ? `${doc.seo.metaTitle} (${doc.seo.metaTitle.length} chars)` : "missing" },
		{
			label: "Meta description",
			value: doc.seo?.metaDescription ? `${doc.seo.metaDescription} (${doc.seo.metaDescription.length} chars)` : "missing",
		},
		...(doc.publishedAt ? [{ label: "Published", value: doc.publishedAt.slice(0, 10) }] : []),
	].filter((f) => f.value);
	return {
		kind: "blog_post",
		id: String(doc.id),
		title: doc.title ?? "(untitled)",
		status: doc.status,
		url: `/blog/${encodeURIComponent(String(doc.id))}`,
		facts,
		text: clip(text, TEXT_LIMIT),
		...(headings.length > 0 ? { lists: [{ label: "Headings", items: headings.slice(0, 30) }] } : {}),
		...(media.length > 0 ? { media: media.slice(0, MEDIA_LIMIT) } : {}),
		updatedAt: doc.updatedAt,
	};
}
