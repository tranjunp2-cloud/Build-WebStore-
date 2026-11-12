import "server-only";

import type { ChangeSet, ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import DOMPurify from "isomorphic-dompurify";
import { getPayload } from "payload";
import { z } from "zod";
import { getTenantId, saveBlogForUser, type UserWithTenants } from "@/lib/blog/save-blog";
import { findOwnPost } from "../agent-tools/record-snapshot";
import type { AgentActor } from "../context";
import { ChangeSetApplyError, type AttachmentLoader } from "./errors";
import { type MediaDoc, ingestPicture } from "./picture-ingest";

export const ImageRefSchema = z.object({
	ref: z.string().min(1).max(200),
	url: z.string().max(2000).optional(),
	name: z.string().max(200).optional(),
	caption: z.string().max(200).nullish(),
	credit: z.string().max(200).nullish(),
});

export const BlogDraftPayloadSchema = z.object({
	locale: z.string().min(2).max(10),
	title: z.string().min(1).max(160),
	slug: z.string().min(1).max(80),
	contentHtml: z.string().min(1).max(40_000),
	seoTitle: z.string().max(70).default(""),
	seoDescription: z.string().max(170).default(""),
	cover: ImageRefSchema.optional(),
	images: z.array(ImageRefSchema).max(6).default([]),
});

const ALLOWED_TAGS = ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "br"];

/** Model output is untrusted HTML — keep only the structural tags the post editor expects. */
export function sanitizeBlogHtml(html: string): string {
	return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

const FIGURE = /<figure data-ref="([^"]+)">[\s\S]*?<\/figure>/g;
const UNDO_DAYS = 7;
const undoUntil = (now = new Date()) => new Date(now.getTime() + UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString();

type Cms = Awaited<ReturnType<typeof getPayload>>;
type CreatedPost = { id: string | number; title?: string | null; updatedAt?: string | null; deletedAt?: string | null; tenant?: unknown };

/** The post an earlier try of this same approval created (its `aiChangeSetId`), trashed ones included. */
async function postCreatedBy(cms: Cms, tenantId: string, changeSetId: string): Promise<CreatedPost | null> {
	const found = await cms.find({
		collection: "blogs",
		where: { and: [{ aiChangeSetId: { equals: changeSetId } }, { tenant: { equals: Number.isNaN(Number(tenantId)) ? tenantId : Number(tenantId) } }] },
		limit: 1,
		depth: 0,
		trash: true,
		overrideAccess: true,
	} as Parameters<Cms["find"]>[0]);
	return (found.docs[0] as unknown as CreatedPost | undefined) ?? null;
}

function draftResult(post: { id: string; title: string; updatedAt: string }, missing = 0): ChangeSetResult {
	return {
		entities: [{ kind: "blog_post", id: post.id, label: post.title }],
		links: [
			{
				label: missing > 0 ? `Open blog draft (${missing} photo${missing === 1 ? "" : "s"} could not be added)` : "Open blog draft",
				href: `/blog/${encodeURIComponent(post.id)}`,
			},
		],
		// Undo moves the new draft to the trash while nobody edited it (restorable from there)
		undo: { kind: "blog.trash_created", payload: { id: post.id, expect: post.updatedAt }, until: undoUntil() },
	};
}

/**
 * A picture into the media library, for this workspace: stock and the merchant's uploads become new rows, a
 * `media:<id>` pick from the shop's library is reused (picture-ingest checks the workspace may use it).
 */
export async function ingestBlogImage(
	cms: Cms,
	actor: AgentActor,
	image: z.infer<typeof ImageRefSchema>,
	alt: string,
	loadAttachment?: AttachmentLoader,
): Promise<MediaDoc> {
	return ingestPicture(cms, image, alt, loadAttachment, actor.tenantId);
}

/**
 * Saves the approved post as a *draft* through the same code path as the blog
 * editor (saveBlogForUser) — same plan gate (content_management), tenant/site
 * binding and slug de-duplication, under the approving user's identity.
 * Photos (stock, the merchant's uploads) are copied into the media library first, a library
 * pick is reused; the cover becomes the post thumbnail.
 */
export async function applyBlogDraft(
	rawPayload: unknown,
	actor: AgentActor,
	loadAttachment?: AttachmentLoader,
	changeSet?: Pick<ChangeSet, "id">,
): Promise<ChangeSetResult> {
	const payload = BlogDraftPayloadSchema.parse(rawPayload);
	// the blog editor saves into the user's first workspace: a draft must land in the one the copilot was asked in
	if (String(getTenantId(actor.user as unknown as UserWithTenants) ?? "") !== String(actor.tenantId)) {
		throw new ChangeSetApplyError("Blog posts are saved to your main workspace. Switch to it and ask again.", 409);
	}
	const cms = await getPayload({ config });
	// a retry of the same approval (its record was lost, the function was stopped) finds the post it made: no second post, no new photos
	if (changeSet?.id) {
		const replay = await postCreatedBy(cms, actor.tenantId, changeSet.id);
		if (replay) return draftResult({ id: String(replay.id), title: replay.title ?? payload.title, updatedAt: String(replay.updatedAt ?? "") });
	}
	const byRef = new Map<string, MediaDoc | null>();

	const ingest = async (image: z.infer<typeof ImageRefSchema>): Promise<MediaDoc | null> => {
		if (byRef.has(image.ref)) return byRef.get(image.ref) ?? null;
		try {
			const doc = await ingestBlogImage(cms, actor, image, image.caption ?? image.name ?? payload.title, loadAttachment);
			byRef.set(image.ref, doc);
			return doc;
		} catch (error) {
			console.warn("[ai-agent] blog photo skipped", image.ref, error instanceof Error ? error.message : error);
			byRef.set(image.ref, null);
			return null;
		}
	};

	const cover = payload.cover ? await ingest(payload.cover) : null;
	// figures the platform placed → our own <img> markup after sanitizing the model's text
	const placed: string[] = [];
	let html = payload.contentHtml;
	for (const match of payload.contentHtml.matchAll(FIGURE)) {
		const ref = match[1] ?? "";
		const image = payload.images.find((i) => i.ref === ref);
		const doc = image ? await ingest(image) : null;
		const token = `ECHIMG${placed.length}X`;
		const caption = [image?.credit, image?.caption].filter(Boolean).join(" · ");
		placed.push(
			doc?.url
				? `<img src="${escapeHtml(doc.url)}" alt="${escapeHtml(image?.caption ?? "")}">${caption ? `<p><em>${escapeHtml(caption)}</em></p>` : ""}`
				: "",
		);
		html = html.replace(match[0], `<p>${token}</p>`);
	}
	let content = sanitizeBlogHtml(html);
	placed.forEach((markup, index) => {
		content = content.replace(`<p>ECHIMG${index}X</p>`, markup);
	});

	const result = (await saveBlogForUser(actor.user as unknown as UserWithTenants, {
		title: payload.title,
		slug: payload.slug,
		content,
		status: "draft",
		...(cover ? { thumbnail: String(cover.id) } : {}),
		seo: { metaTitle: payload.seoTitle, metaDescription: payload.seoDescription },
		...(changeSet?.id ? { aiChangeSetId: changeSet.id } : {}),
	})) as { id?: string | number; error?: string; updatedAt?: string };
	if (!result || result.error || result.id === undefined) {
		throw new ChangeSetApplyError(result?.error ?? "Failed to save the blog draft.");
	}
	const missing = [payload.cover, ...payload.images].filter((image) => image && byRef.get(image.ref) === null).length;
	return draftResult({ id: String(result.id), title: payload.title, updatedAt: String(result.updatedAt ?? "") }, missing);
}

const TrashCreatedSchema = z.object({ id: z.string().min(1).max(40), expect: z.string().max(40) });

/**
 * Undo of a copilot blog draft (`blog.trash_created`): the post goes to the trash (restorable there) while nobody
 * edited it since it was created. Already in the trash or gone: nothing to do (a repeated undo succeeds).
 */
export async function applyBlogTrashCreated(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const parsed = TrashCreatedSchema.safeParse(raw);
	if (!parsed.success) throw new ChangeSetApplyError("This change can't be undone here.", 422);
	const { id, expect } = parsed.data;
	const cms = await getPayload({ config });
	const post = await findOwnPost(cms, actor.user, actor.tenantId, id);
	const links = [{ label: "Open the blog list", href: "/blog" }];
	if (!post || post.deletedAt) return { entities: [], links };
	const untouched = Boolean(expect) && (post.updatedAt === expect || Date.parse(post.updatedAt ?? "") === Date.parse(expect));
	if (!untouched) {
		throw new ChangeSetApplyError("This post was edited after the assistant created it, so it can't be undone without losing that edit. Move it to the trash on the Blog page.", 409);
	}
	await cms.update({
		collection: "blogs",
		id: Number.isNaN(Number(id)) ? id : Number(id),
		data: { deletedAt: new Date().toISOString() },
		user: actor.user,
		overrideAccess: false,
		trash: true,
	} as Parameters<Cms["update"]>[0]);
	// read it back: a write the CMS ignored must never be reported as done
	const check = await findOwnPost(cms, actor.user, actor.tenantId, id);
	if (check && !check.deletedAt) throw new ChangeSetApplyError("The blog trash is not available right now. Nothing was removed.", 409);
	return { entities: [{ kind: "blog_post", id }], links };
}
