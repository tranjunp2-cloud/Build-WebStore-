import "server-only";

import type { Payload } from "payload";
import { clip, postText } from "./content-tools";

/**
 * The exact current state of one record, read just before the copilot stages
 * a change to it: the values a diff shows as "before" and the version the
 * apply step must still find (anything newer means someone edited it since —
 * the change is refused, never written over).
 */
export interface RecordSnapshot {
	kind: "product" | "blog_post";
	id: string;
	title: string;
	status: string;
	/** the record's updatedAt (the version the apply step must still find) */
	version: string;
	/** in the trash */
	removed: boolean;
	/** editable fields, display strings (null = empty) */
	fields: Record<string, string | null>;
}

interface PostDoc {
	id: number | string;
	title?: string;
	status?: string;
	content?: unknown;
	updatedAt?: string;
	deletedAt?: string | null;
	tenant?: { id?: number | string } | number | string | null;
	thumbnail?: { id?: number | string; alt?: string | null } | number | string | null;
	seo?: { metaTitle?: string | null; metaDescription?: string | null } | null;
}

/** A post of this workspace, trashed ones included (so they can be restored); null when not theirs. */
export async function findOwnPost(
	payload: Pick<Payload, "find">,
	user: unknown,
	tenantId: string,
	id: string,
): Promise<PostDoc | null> {
	const tenant = Number.isNaN(Number(tenantId)) ? tenantId : Number(tenantId);
	const result = await payload.find({
		collection: "blogs",
		where: { and: [{ id: { equals: Number.isNaN(Number(id)) ? id : Number(id) } }, { tenant: { equals: tenant } }] },
		limit: 1,
		depth: 1,
		trash: true,
		overrideAccess: false,
		user,
	} as Parameters<Payload["find"]>[0]);
	return (result.docs[0] as unknown as PostDoc | undefined) ?? null;
}

export function postSnapshot(doc: PostDoc): RecordSnapshot {
	const thumbnail = typeof doc.thumbnail === "object" && doc.thumbnail ? doc.thumbnail : null;
	const { text } = postText(doc.content);
	return {
		kind: "blog_post",
		id: String(doc.id),
		title: doc.title ?? "(untitled)",
		status: doc.status ?? "draft",
		version: doc.updatedAt ?? "",
		removed: Boolean(doc.deletedAt),
		fields: {
			title: doc.title ?? null,
			content: text.trim() ? clip(text, 2_000) : null,
			seoTitle: doc.seo?.metaTitle ?? null,
			seoDescription: doc.seo?.metaDescription ?? null,
			cover: thumbnail ? (thumbnail.alt || `picture ${thumbnail.id}`) : null,
		},
	};
}

export async function snapshotPost(payload: Pick<Payload, "find">, user: unknown, tenantId: string, id: string): Promise<RecordSnapshot | null> {
	const doc = await findOwnPost(payload, user, tenantId, id);
	return doc ? postSnapshot(doc) : null;
}
