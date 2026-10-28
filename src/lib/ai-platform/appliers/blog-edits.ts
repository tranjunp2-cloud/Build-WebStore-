import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import type { PlanCode } from "@/collections/PlanSubscriptions";
import { canUse, getActivePlanSubscription } from "@/lib/subscriptions/plan-subscription";
import { findOwnPost } from "../agent-tools/record-snapshot";
import type { AgentActor } from "../context";
import { ImageRefSchema, ingestBlogImage, sanitizeBlogHtml } from "./blog-draft";
import { ChangeSetApplyError, staleChange, type AttachmentLoader } from "./errors";
import { samePlan } from "./same-plan";

/**
 * Edits, trash and undo of existing blog posts, applied with the approver's own access. Every write is guarded
 * three ways:
 * 1. the post must still be at the version the change was drafted from (`base` = updatedAt), otherwise 409
 *    and nothing is written;
 * 2. the post's previous values are captured first and returned as `undo`;
 * 3. nothing is destroyed: "delete" moves a post to the trash (Blogs.trash), where undo restores it.
 */

const UNDO_DAYS = 7;
const CHANGED_SINCE = "This changed after the assistant drafted the edit. Ask again so it starts from the latest version.";

function undoUntil(now = new Date()): string {
	return new Date(now.getTime() + UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export const BlogUpdatePayloadSchema = z.object({
	id: z.string().min(1).max(40),
	/** updatedAt the change was drafted from */
	base: z.string().min(1),
	changes: z.object({
		title: z.string().min(1).max(160).optional(),
		contentHtml: z.string().min(1).max(40_000).optional(),
		seoTitle: z.string().max(70).optional(),
		seoDescription: z.string().max(170).optional(),
		cover: ImageRefSchema.optional(),
	}),
});

/** Restores fields exactly as they were (undo of an edit) — raw stored values. */
const BlogRestorePayloadSchema = z.object({
	id: z.string().min(1).max(40),
	base: z.string().min(1),
	data: z.record(z.string(), z.unknown()),
});

export const BlogStatusPayloadSchema = z.object({
	id: z.string().min(1).max(40),
	base: z.object({ status: z.string(), removed: z.boolean() }),
	to: z.enum(["publish", "unpublish", "trash", "restore"]),
});

type Cms = Awaited<ReturnType<typeof getPayload>>;

async function assertPlan(cms: Cms, tenantId: string) {
	const sub = await getActivePlanSubscription(cms, Number(tenantId));
	if (!sub || !(await canUse(cms, sub.plan as PlanCode, "content_management"))) {
		throw new ChangeSetApplyError("Content management is not available on your current plan.", 403);
	}
}

/** The post at the version the change was drafted from; gone or changed since → the change can never apply (closed). */
async function ownPost(cms: Cms, actor: AgentActor, id: string, base: string | null) {
	const doc = await findOwnPost(cms, actor.user, actor.tenantId, id);
	if (!doc) throw staleChange("This post is not in your workspace anymore.");
	if (base !== null && doc.updatedAt !== base) throw staleChange(CHANGED_SINCE);
	return doc;
}

const IMG_BLOCK = /<img\b[^>]*>(?:\s*<p><em>[\s\S]*?<\/em><\/p>)?/gi;

/**
 * New article text never silently drops the post's pictures: when the new
 * text has none, the old ones are put back between its paragraphs, in order.
 */
export function keepPictures(oldHtml: string, newHtml: string): string {
	const pictures = oldHtml.match(IMG_BLOCK) ?? [];
	if (pictures.length === 0 || /<img\b/i.test(newHtml)) return newHtml;
	const parts = newHtml.split(/(?<=<\/p>)/);
	const step = Math.max(1, Math.floor(parts.length / (pictures.length + 1)));
	pictures.forEach((picture, i) => {
		const at = Math.min(parts.length, step * (i + 1)) - 1;
		parts[at] = `${parts[at] ?? ""}${picture}`;
	});
	return parts.join("");
}

async function update(cms: Cms, actor: AgentActor, id: string, data: Record<string, unknown>, trash = false) {
	return (await cms.update({
		collection: "blogs",
		id: Number.isNaN(Number(id)) ? id : Number(id),
		data,
		user: actor.user,
		overrideAccess: false,
		...(trash ? { trash: true } : {}),
	} as Parameters<Cms["update"]>[0])) as unknown as { updatedAt?: string };
}

export async function applyBlogUpdate(raw: unknown, actor: AgentActor, loadAttachment?: AttachmentLoader): Promise<ChangeSetResult> {
	const { id, base, changes } = BlogUpdatePayloadSchema.parse(raw);
	const cms = await getPayload({ config });
	await assertPlan(cms, actor.tenantId);
	const doc = (await ownPost(cms, actor, id, base)) as Awaited<ReturnType<typeof findOwnPost>> & { content?: unknown };
	if (doc?.deletedAt) throw new ChangeSetApplyError("This post is in the trash. Restore it first.", 409);
	if (changes.contentHtml !== undefined && doc?.content !== undefined && doc.content !== null && typeof doc.content !== "string") {
		throw new ChangeSetApplyError("This post's body uses the rich-text editor; edit its text there.", 422);
	}
	const thumbnail = typeof doc?.thumbnail === "object" && doc.thumbnail ? doc.thumbnail.id : (doc?.thumbnail ?? null);
	const data: Record<string, unknown> = {};
	const before: Record<string, unknown> = {};
	if (changes.title !== undefined) {
		data.title = changes.title;
		before.title = doc?.title ?? null;
	}
	if (changes.contentHtml !== undefined) {
		data.content = keepPictures(typeof doc?.content === "string" ? doc.content : "", sanitizeBlogHtml(changes.contentHtml));
		before.content = doc?.content ?? null;
	}
	if (changes.seoTitle !== undefined || changes.seoDescription !== undefined) {
		data.seo = {
			...(doc?.seo ?? {}),
			...(changes.seoTitle !== undefined ? { metaTitle: changes.seoTitle } : {}),
			...(changes.seoDescription !== undefined ? { metaDescription: changes.seoDescription } : {}),
		};
		before.seo = doc?.seo ?? {};
	}
	if (changes.cover) {
		const media = await ingestBlogImage(cms, actor, changes.cover, changes.title ?? doc?.title ?? "Cover", loadAttachment).catch(() => null);
		if (!media) throw new ChangeSetApplyError("The new cover picture could not be added. Nothing was changed.", 422);
		data.thumbnail = media.id;
		before.thumbnail = thumbnail;
	}
	const saved = await update(cms, actor, id, data);
	return {
		entities: [{ kind: "blog_post", id }],
		links: [{ label: "Open post", href: `/blog/${encodeURIComponent(id)}` }],
		undo: { kind: "blog.restore_fields", payload: { id, base: saved.updatedAt ?? "", data: before }, until: undoUntil() },
	};
}

export async function applyBlogRestoreFields(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const { id, base, data } = BlogRestorePayloadSchema.parse(raw);
	const cms = await getPayload({ config });
	const doc = await ownPost(cms, actor, id, null);
	const current: Record<string, unknown> = Object.fromEntries(
		Object.keys(data).map((key) => [key, key === "thumbnail" ? (typeof doc.thumbnail === "object" && doc.thumbnail ? doc.thumbnail.id : doc.thumbnail) : (doc as unknown as Record<string, unknown>)[key]]),
	);
	// already as before the change (an undo whose record was lost, a second tab): nothing to write
	if (Object.keys(data).every((key) => samePlan(current[key] ?? null, data[key] ?? null))) {
		return { entities: [{ kind: "blog_post", id }], links: [{ label: "Open post", href: `/blog/${encodeURIComponent(id)}` }] };
	}
	if (doc.updatedAt !== base) throw new ChangeSetApplyError(CHANGED_SINCE, 409);
	const saved = await update(cms, actor, id, data);
	return {
		entities: [{ kind: "blog_post", id }],
		links: [{ label: "Open post", href: `/blog/${encodeURIComponent(id)}` }],
		undo: { kind: "blog.restore_fields", payload: { id, base: saved.updatedAt ?? "", data: current }, until: undoUntil() },
	};
}

const INVERSE = { publish: "unpublish", unpublish: "publish", trash: "restore", restore: "trash" } as const;

/** Status / trash change of a post; `undo`: the undo of one (a post already where the undo puts it needs nothing). */
export async function applyBlogStatus(raw: unknown, actor: AgentActor, options: { undo?: boolean } = {}): Promise<ChangeSetResult> {
	const { id, base, to } = BlogStatusPayloadSchema.parse(raw);
	const cms = await getPayload({ config });
	const doc = await ownPost(cms, actor, id, null);
	const status = doc.status ?? "draft";
	if (status !== base.status || Boolean(doc.deletedAt) !== base.removed) {
		const target = { status: to === "publish" ? "published" : to === "unpublish" ? "draft" : base.status, removed: to === "trash" ? true : to === "restore" ? false : base.removed };
		if (options.undo && status === target.status && Boolean(doc.deletedAt) === target.removed) {
			return { entities: [{ kind: "blog_post", id }], links: [{ label: to === "trash" ? "Open the blog list" : "Open post", href: to === "trash" ? "/blog" : `/blog/${encodeURIComponent(id)}` }] };
		}
		throw options.undo ? new ChangeSetApplyError(CHANGED_SINCE, 409) : staleChange(CHANGED_SINCE);
	}
	if (to === "publish") await assertPlan(cms, actor.tenantId);
	const data: Record<string, unknown> =
		to === "publish"
			? { status: "published", ...((doc as { publishedAt?: string | null }).publishedAt ? {} : { publishedAt: new Date().toISOString() }) }
			: to === "unpublish"
				? { status: "draft" }
				: to === "trash"
					? { deletedAt: new Date().toISOString() }
					: { deletedAt: null };
	await update(cms, actor, id, data, to === "trash" || to === "restore");
	const after = {
		status: (data.status as string | undefined) ?? base.status,
		removed: to === "trash" ? true : to === "restore" ? false : base.removed,
	};
	// read it back: a write the CMS ignored must never be reported as done
	const check = await findOwnPost(cms, actor.user, actor.tenantId, id);
	if (!check || (check.status ?? "draft") !== after.status || Boolean(check.deletedAt) !== after.removed) {
		throw new ChangeSetApplyError(
			to === "trash" || to === "restore" ? "The blog trash is not available right now. Nothing was removed." : "The post's status did not change. Try again.",
			409,
		);
	}
	return {
		entities: [{ kind: "blog_post", id }],
		links: [{ label: to === "trash" ? "Open the blog list" : "Open post", href: to === "trash" ? "/blog" : `/blog/${encodeURIComponent(id)}` }],
		undo: { kind: "blog.set_status", payload: { id, base: after, to: INVERSE[to] }, until: undoUntil() },
	};
}
