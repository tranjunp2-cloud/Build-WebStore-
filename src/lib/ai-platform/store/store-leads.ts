import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { getLeadAs, getTenantSiteIds, LEAD_DB_TO_DISPLAY, leadMessagesAs, leadSiteId } from "@/lib/leads/lead-service";
import { leadReplyContext, MAX_REPLIES_PER_DAY, MAX_REPLIES_PER_HOUR } from "@/lib/leads/lead-reply";
import type { AgentActor } from "../context";
import { clip, day, UNTRUSTED } from "./store-customers-text";

/**
 * The contact-form leads for the copilot (the dashboard's Contact leads). `contact-submissions` is readable by
 * super-admins only, so — like the dashboard — it is read without a user and kept to the workspace through its
 * sites. A "lead" is one person on one site (email + site): the list shows their latest message, the status
 * every message of theirs shares, and how many replies the shop already sent. Messages are visitors' words.
 */

const MAX_READ = 1000;
const DAY_MS = 86_400_000;
const ROW_FIELDS = ["new", "read", "contacted", "ignored"] as const;

type Doc = Record<string, unknown>;
type Person = { latest: Doc; messages: number; replies: number };

/** The newest message of each person (email + site) with how many messages and replies they have. */
function people(docs: Doc[]): Person[] {
	const byKey = new Map<string, Person>();
	for (const doc of docs) {
		const key = `${String(doc.email).toLowerCase()}|${leadSiteId(doc)}`;
		const replies = Array.isArray(doc.replies) ? doc.replies.length : 0;
		const known = byKey.get(key);
		if (!known) byKey.set(key, { latest: doc, messages: 1, replies });
		else {
			known.messages += 1;
			known.replies += replies;
			if (new Date(String(doc.createdAt)) > new Date(String(known.latest.createdAt))) known.latest = doc;
		}
	}
	return [...byKey.values()].sort((a, b) => new Date(String(b.latest.createdAt)).getTime() - new Date(String(a.latest.createdAt)).getTime());
}

const statusOf = (doc: Doc) => LEAD_DB_TO_DISPLAY[String(doc.status ?? "new")] ?? "new";

export async function readLeads(actor: AgentActor, input: { query?: string | null; leadStatus?: string | null; olderThanDays?: number | null; limit?: number | null }, now: Date = new Date()) {
	const cms = await getPayload({ config });
	const siteIds = await getTenantSiteIds(cms, actor.tenantId);
	if (siteIds.length === 0) return { note: UNTRUSTED, counts: { new: 0, read: 0, contacted: 0, ignored: 0 }, leads: [], matching: 0 };
	const res = await cms.find({ collection: "contact-submissions", where: { site: { in: siteIds } }, sort: "-createdAt", limit: MAX_READ, depth: 0 });
	const all = people(res.docs as unknown as Doc[]);

	const words = input.query?.toLowerCase();
	const status = input.leadStatus && input.leadStatus !== "any" ? input.leadStatus : null;
	const older = input.olderThanDays ?? null;
	const found = all.filter((p) => {
		if (status && statusOf(p.latest) !== status) return false;
		if (older !== null && now.getTime() - new Date(String(p.latest.createdAt)).getTime() < older * DAY_MS) return false;
		if (!words) return true;
		return [p.latest.name, p.latest.email, p.latest.subject, p.latest.message].some((v) => String(v ?? "").toLowerCase().includes(words));
	});
	const counts = Object.fromEntries(ROW_FIELDS.map((s) => [s, all.filter((p) => statusOf(p.latest) === s).length]));
	return {
		note: `Contact-form leads, one per person (their latest message). "contacted" = replied, "ignored" = archived. ${UNTRUSTED} Reply or change status with propose_store_customers; read view lead first to answer.`,
		counts,
		...(res.totalDocs > res.docs.length ? { truncated: `Only the newest ${res.docs.length} of ${res.totalDocs} messages were read.` } : {}),
		leads: found.slice(0, input.limit ?? 10).map((p) => ({
			id: String(p.latest.id),
			name: String(p.latest.name ?? ""),
			email: String(p.latest.email ?? ""),
			phone: p.latest.phone ?? null,
			subject: p.latest.subject ? clip(p.latest.subject, 120) : null,
			status: statusOf(p.latest),
			messages: p.messages,
			repliesSent: p.replies,
			lastMessage: day(p.latest.createdAt),
			ageDays: Math.floor((now.getTime() - new Date(String(p.latest.createdAt)).getTime()) / DAY_MS),
			preview: clip(p.latest.message, 160),
		})),
		matching: found.length,
	};
}

export async function readLead(actor: AgentActor, id: number) {
	const cms = await getPayload({ config });
	let lead: Doc;
	try {
		({ lead } = await getLeadAs(actor, id));
	} catch {
		return { error: { code: "unknown_lead", message: "No such lead in this workspace (read store_customers view leads for ids)." } };
	}
	const messages = (await leadMessagesAs(cms, lead, 20)).reverse();
	const context = await leadReplyContext({ tenantId: actor.tenantId, user: actor.user }, id).catch(() => null);
	const replies = messages.flatMap((m) =>
		(Array.isArray(m.replies) ? (m.replies as Doc[]) : []).map((r) => ({ subject: String(r.subject ?? ""), body: clip(r.body, 1200), sentAt: String(r.sentAt ?? ""), sentBy: r.sentBy ?? null })),
	);
	return {
		note: `${UNTRUSTED} To answer, write the whole email in the language of THEIR message and stage it with propose_store_customers (op lead_reply).`,
		lead: {
			id: String(lead.id),
			name: String(lead.name ?? ""),
			email: String(lead.email ?? ""),
			phone: lead.phone ?? null,
			status: statusOf(lead),
			source: lead.source ?? null,
		},
		shop: context ? { name: context.shopName, replyToEmail: context.replyTo || null } : null,
		messages: messages.map((m) => ({ id: String(m.id), at: String(m.createdAt ?? ""), subject: m.subject ? clip(m.subject, 200) : null, message: clip(m.message, 1500), status: statusOf(m) })),
		repliesAlreadySent: replies,
		replyLimit: `At most ${MAX_REPLIES_PER_HOUR} replies per hour and ${MAX_REPLIES_PER_DAY} per day for the whole shop.`,
	};
}
