import "server-only";

import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import { z } from "zod";
import { discountActivationBlocks } from "@/lib/discounts/activation-guard";
import { klDateKey } from "@/lib/discounts/date-boundaries";
import { computeEffectiveDiscountStatus, type EffectiveDiscountStatus } from "@/lib/discounts/effective-status";
import { fmtDate, fmtRM } from "@/lib/discounts/format";
import { canAccessArea } from "@/lib/insights/area-access";
import { createDiscountSchema } from "@/lib/validations/discounts";
import type { AgentActor } from "../context";

/**
 * The shop's discount codes for the copilot (the dashboard's Discounts): read the list with each code's
 * live state and usage, or one code in full. Drafting a change is in store-discounts-prepare.ts; the
 * applier (appliers/store-discounts.ts) runs the dashboard's own write rules, as the approver.
 * Dates are the shop's calendar days (Asia/Kuala_Lumpur, like the Discounts form); money is RM.
 */

export const MAX_DISCOUNTS = 500;

/**
 * Discounts sit under the `orders` permission: the sidebar entry (config/sidebar-nav.ts) uses `permissionId: 'orders'`
 * and the Discounts pages have no guard of their own, so that is the dashboard's rule. Owner / admin / editor / viewer
 * have it, a custom role only when it holds `orders` (a staff member with only `products` or `blog` does not).
 * Used for reads, drafts and applying alike.
 */
export function discountsRefusal(actor: AgentActor): { error: { code: string; message: string } } | null {
	return canAccessArea(actor.user, actor.tenantId, "orders") ? null : { error: { code: "forbidden", message: "Your role in this workspace can't use Discounts (it needs the Orders permission)." } };
}
const EXPIRING_SOON_DAYS = 14;

export type DiscountRow = {
	id: number;
	code: string;
	description: string | null;
	type: "percentage" | "fixed";
	/** percentage 0–100, or sen for a fixed amount (as stored) */
	value: number;
	status: "active" | "inactive";
	usageLimit: number | null;
	usageCount: number;
	/** stored instants (the collection pins them to the KL day boundaries) */
	startsAt: string | null;
	expiresAt: string | null;
	site: number | null;
	updatedAt: string;
};

const relId = (value: unknown): number | null => {
	const raw = value && typeof value === "object" ? (value as { id?: unknown }).id : value;
	const id = typeof raw === "string" ? Number(raw) : raw;
	return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
};

/** Payload's integer ids: all-digit strings become numbers so `where` matches the integer columns. */
export const queryId = (id: string | number): string | number => (typeof id === "string" && /^\d+$/.test(id) ? Number(id) : id);

const iso = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

export const discountRow = (doc: Record<string, unknown>): DiscountRow => ({
	id: Number(doc.id),
	code: String(doc.code ?? ""),
	description: typeof doc.description === "string" && doc.description ? doc.description : null,
	type: doc.type === "fixed" ? "fixed" : "percentage",
	value: Number(doc.value ?? 0),
	status: doc.status === "active" ? "active" : "inactive",
	usageLimit: typeof doc.usageLimit === "number" ? doc.usageLimit : null,
	usageCount: Number(doc.usageCount ?? 0),
	startsAt: iso(doc.startsAt),
	expiresAt: iso(doc.expiresAt),
	site: relId(doc.site),
	updatedAt: String(doc.updatedAt ?? ""),
});

function userOf(actor: AgentActor) {
	return actor.user as unknown as Parameters<Payload["find"]>[0]["user"];
}

/** The tenant's discounts, as its user may see them (newest first). */
export async function tenantDiscounts(cms: Payload, actor: AgentActor): Promise<{ rows: DiscountRow[]; total: number }> {
	const result = await cms.find({
		collection: "discounts",
		where: { tenant: { equals: queryId(actor.tenantId) } },
		depth: 0,
		limit: MAX_DISCOUNTS,
		sort: "-createdAt",
		overrideAccess: false,
		user: userOf(actor),
	} as Parameters<Payload["find"]>[0]);
	return { rows: (result.docs as unknown as Array<Record<string, unknown>>).map(discountRow), total: result.totalDocs ?? result.docs.length };
}

/** The tenant's sites by id (a discount may be limited to one). Empty when the user can't list them. */
export async function tenantSites(cms: Payload, actor: AgentActor): Promise<Map<number, string>> {
	try {
		const result = await cms.find({
			collection: "sites",
			where: { tenant: { equals: queryId(actor.tenantId) } },
			depth: 0,
			limit: 100,
			overrideAccess: false,
			user: userOf(actor),
			select: { name: true },
		} as Parameters<Payload["find"]>[0]);
		return new Map((result.docs as unknown as Array<{ id: unknown; name?: unknown }>).map((s) => [Number(s.id), String(s.name ?? s.id)]));
	} catch {
		return new Map();
	}
}

// ─── Words for the merchant ──────────────────────────────────────────────────

export const valueText = (type: DiscountRow["type"], value: number) => (type === "percentage" ? `${value}% off` : `${fmtRM(value)} off`);
const usedText = (count: number, limit: number | null) => (limit === null ? `${count} used` : `${count}/${limit} used`);

const STATUS_WORDS: Record<EffectiveDiscountStatus, string> = { active: "Active", inactive: "Inactive", scheduled: "Scheduled", expired: "Expired", "used-up": "Used up" };
export const statusWord = (status: EffectiveDiscountStatus) => STATUS_WORDS[status];

const windowText = (startsAt: string | null, expiresAt: string | null) => {
	if (startsAt && expiresAt) return `${fmtDate(startsAt)} – ${fmtDate(expiresAt)}`;
	if (expiresAt) return `until ${fmtDate(expiresAt)}`;
	if (startsAt) return `from ${fmtDate(startsAt)}`;
	return "no end date";
};

export const effectiveOf = (row: DiscountRow, now: Date) => computeEffectiveDiscountStatus(row, now);

/** "10% off · until 31 Dec 2026 · 0/100 used" (+ "· expired" when it is not live) — the line the cards and reads share. */
export function describeDiscount(row: DiscountRow, now: Date): string {
	const effective = effectiveOf(row, now);
	return [valueText(row.type, row.value), windowText(row.startsAt, row.expiresAt), usedText(row.usageCount, row.usageLimit), ...(effective === "active" ? [] : [statusWord(effective).toLowerCase()])].join(" · ");
}

/** Why a discount can't be switched on, in the merchant's words (the dashboard form's own guard); null when it can. */
export function activationProblem(row: Pick<DiscountRow, "code" | "expiresAt" | "usageLimit" | "usageCount">, now: Date): { code: string; message: string } | null {
	const block = discountActivationBlocks({ expiresAt: row.expiresAt ? klDateKey(row.expiresAt) : null, usageLimit: row.usageLimit, usageCount: row.usageCount }, now);
	if (block.expired) {
		return { code: "expired_cannot_activate", message: `"${row.code}" ended on ${fmtDate(row.expiresAt)}, so it can't be switched on. Give it a later end date (or no end date) in the same change, then activate it.` };
	}
	if (block.atLimit) {
		return { code: "at_limit_cannot_activate", message: `"${row.code}" has been used ${row.usageCount} of ${row.usageLimit} times, so it can't be switched on. Raise its usage limit (or remove the limit) in the same change, then activate it.` };
	}
	return null;
}

/** The dashboard's own validation of a discount as it would be saved (percent ≤ 100, fixed cap, end after start, code characters). */
export function candidateProblem(candidate: { code: string; description: string | null; type: "percentage" | "fixed"; value: number; usageLimit: number | null; startsOn: string | null; endsOn: string | null; status: "active" | "inactive" }): string | null {
	const parsed = createDiscountSchema.safeParse({
		code: candidate.code,
		description: candidate.description,
		type: candidate.type,
		value: candidate.value,
		usageLimit: candidate.usageLimit,
		startsAt: candidate.startsOn,
		expiresAt: candidate.endsOn,
		status: candidate.status,
	});
	if (parsed.success) return null;
	const issue = parsed.error.issues[0];
	const where = issue?.path.join(".") || "value";
	const text = issue?.message === "expiresAt must be after startsAt" ? "the end date must be after the start date" : (issue?.message ?? "invalid");
	return `${where}: ${text}`;
}

// ─── Read ────────────────────────────────────────────────────────────────────

const FILTERS = ["all", "active", "inactive", "scheduled", "expired", "used_up", "expiring_soon", "unused"] as const;
export const StoreDiscountsReadSchema = z.object({
	/** one discount, in full */
	id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^[1-9]\d{0,9}$/)).nullish(),
	/** one discount by its exact code */
	code: z.string().trim().max(32).nullish(),
	/** words of a code or description */
	query: z.string().trim().max(80).nullish(),
	filter: z.enum(FILTERS).nullish(),
	limit: z.number().int().min(1).max(30).nullish(),
});

const matches = (row: DiscountRow, filter: (typeof FILTERS)[number], now: Date): boolean => {
	const effective = effectiveOf(row, now);
	switch (filter) {
		case "all":
			return true;
		case "used_up":
			return effective === "used-up";
		case "unused":
			return row.usageCount === 0;
		case "expiring_soon": {
			if (!row.expiresAt || (effective !== "active" && effective !== "scheduled")) return false;
			const ends = new Date(row.expiresAt).getTime();
			return ends >= now.getTime() && ends <= now.getTime() + EXPIRING_SOON_DAYS * 86_400_000;
		}
		default:
			return effective === filter;
	}
};

export async function readStoreDiscounts(actor: AgentActor, raw: unknown, now: Date = new Date()) {
	const input = StoreDiscountsReadSchema.parse(raw ?? {});
	const denied = discountsRefusal(actor);
	if (denied) return denied;
	const cms = await getPayload({ config });
	const [{ rows, total }, sites] = await Promise.all([tenantDiscounts(cms, actor), tenantSites(cms, actor)]);
	const siteOf = (row: DiscountRow) => (row.site === null ? "all sites" : (sites.get(row.site) ?? `site ${row.site}`));
	const shop = { currency: "MYR", timezone: "Asia/Kuala_Lumpur", today: klDateKey(now) };

	if (input.id || input.code) {
		const row = input.id ? rows.find((r) => String(r.id) === input.id) : rows.find((r) => r.code.toUpperCase() === input.code!.trim().toUpperCase());
		if (!row) return { error: { code: "unknown_discount", message: "No such discount in this store (read store_discounts without an id for the list)." } };
		const effective = effectiveOf(row, now);
		const problem = row.status === "inactive" || effective !== "active" ? activationProblem(row, now) : null;
		return {
			shop,
			discount: {
				id: String(row.id),
				code: row.code,
				...(row.description ? { description: row.description } : {}),
				type: row.type,
				...(row.type === "percentage" ? { percent: row.value } : { amountRM: row.value / 100 }),
				summary: describeDiscount(row, now),
				status: row.status,
				effectiveStatus: effective,
				startsOn: row.startsAt ? klDateKey(row.startsAt) : null,
				endsOn: row.expiresAt ? klDateKey(row.expiresAt) : null,
				usageLimit: row.usageLimit,
				used: row.usageCount,
				usesLeft: row.usageLimit === null ? null : Math.max(0, row.usageLimit - row.usageCount),
				appliesTo: siteOf(row),
				...(problem ? { cannotBeSwitchedOnBecause: problem.message } : {}),
			},
		};
	}

	const filter = input.filter ?? "all";
	const words = input.query?.toLowerCase();
	const found = rows.filter((r) => matches(r, filter, now) && (!words || r.code.toLowerCase().includes(words) || (r.description ?? "").toLowerCase().includes(words)));
	const count = (f: (typeof FILTERS)[number]) => rows.filter((r) => matches(r, f, now)).length;
	return {
		note: `Discount codes of this store (money in RM, dates in the shop's time). effectiveStatus is what shoppers get right now. Change them with propose_store_discounts.`,
		shop,
		counts: { total, active: count("active"), inactive: count("inactive"), scheduled: count("scheduled"), expired: count("expired"), usedUp: count("used_up"), expiringIn14Days: count("expiring_soon"), unused: count("unused") },
		...(total > rows.length ? { truncated: `Only the newest ${rows.length} of ${total} codes were read.` } : {}),
		...(sites.size > 1 ? { sites: [...sites].slice(0, 20).map(([id, name]) => ({ id: String(id), name })) } : {}),
		discounts: found.slice(0, input.limit ?? 20).map((r) => ({
			id: String(r.id),
			code: r.code,
			summary: describeDiscount(r, now),
			status: r.status,
			effectiveStatus: effectiveOf(r, now),
			appliesTo: siteOf(r),
		})),
		matching: found.length,
	};
}
