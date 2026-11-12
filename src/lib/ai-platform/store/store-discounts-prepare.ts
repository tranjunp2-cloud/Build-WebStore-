import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import { endOfDayKL, klDateKey, startOfDayKL } from "@/lib/discounts/date-boundaries";
import { fmtDate, MAX_FIXED_DISCOUNT_RM, MAX_FIXED_DISCOUNT_SEN } from "@/lib/discounts/format";
import type { AgentActor } from "../context";
import type { PreparedSiteChange } from "../site/site-prepare";
import { activationProblem, candidateProblem, type DiscountRow, describeDiscount, discountsRefusal, effectiveOf, tenantDiscounts, tenantSites, valueText } from "./store-discounts";

/**
 * Drafts (never writes) a change to the shop's discount codes, up to 10 steps in one card: create,
 * update (amount, type, limit, dates, description, site, code), activate / pause, delete. Each step runs
 * on the state the earlier ones leave, with the Discounts form's own rules: percent ≤ 100, end after
 * start, a code unique in the store, and the form's activation guard (not expired, not at its limit).
 * The applier (appliers/store-discounts.ts) re-checks them and writes as the approver.
 */

export const MAX_DISCOUNT_STEPS = 10;
const MAX_USAGE_LIMIT = 10_000_000;

const Id = z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(z.string().regex(/^[1-9]\d{0,9}$/, "a discount or site id (digits)"));
const DateKey = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "a date as YYYY-MM-DD")
	.refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "a real calendar date");
const Code = z.string().trim().min(1).max(32);
const Kind = z.enum(["percentage", "fixed"]);

export const StoreDiscountStepSchema = z.discriminatedUnion("op", [
	z.object({
		op: z.literal("create"),
		code: Code,
		type: Kind,
		/** percentage: a whole number 1–100; fixed: RM (not sen) */
		amount: z.number().positive(),
		description: z.string().trim().max(500).nullish(),
		/** null = unlimited */
		usageLimit: z.number().int().min(1).max(MAX_USAGE_LIMIT).nullish(),
		startsOn: DateKey.nullish(),
		endsOn: DateKey.nullish(),
		siteId: Id.nullish(),
		/** null = active from the first day */
		status: z.enum(["active", "paused"]).nullish(),
	}),
	z.object({
		op: z.literal("update"),
		discountId: Id,
		code: Code.nullish(),
		type: Kind.nullish(),
		amount: z.number().positive().nullish(),
		description: z.string().trim().max(500).nullish(),
		usageLimit: z.number().int().min(1).max(MAX_USAGE_LIMIT).nullish(),
		removeLimit: z.boolean().nullish(),
		startsOn: DateKey.nullish(),
		removeStart: z.boolean().nullish(),
		endsOn: DateKey.nullish(),
		removeEnd: z.boolean().nullish(),
		siteId: Id.nullish(),
		allSites: z.boolean().nullish(),
	}),
	z.object({ op: z.literal("activate"), discountId: Id }),
	z.object({ op: z.literal("pause"), discountId: Id }),
	z.object({ op: z.literal("delete"), discountId: Id }),
]);
export type StoreDiscountStep = z.infer<typeof StoreDiscountStepSchema>;

export const StoreDiscountsChangeSchema = z.object({
	why: z.string().trim().min(1).max(300),
	changes: z.array(StoreDiscountStepSchema).min(1).max(MAX_DISCOUNT_STEPS),
});

/** What the dashboard's form sends: dates as the shop's calendar days, money as stored (percent, or sen). */
export type DiscountWrite = {
	code: string;
	description: string | null;
	type: "percentage" | "fixed";
	value: number;
	status: "active" | "inactive";
	usageLimit: number | null;
	startsAt: string | null;
	expiresAt: string | null;
	site: number | null;
};

/** What the applier runs: only the fields a step changes. */
export type PlannedDiscountStep =
	| { op: "create"; data: DiscountWrite }
	| { op: "update"; discountId: number; data: Partial<DiscountWrite> }
	| { op: "delete"; discountId: number };

export type StoreDiscountsPlan = {
	steps: PlannedDiscountStep[];
	/** updatedAt of every existing discount the change touches: anything edited since is not overwritten */
	base: Record<string, string>;
};

type Refusal = { error: { code: string; message: string } };
const refuse = (code: string, message: string): Refusal => ({ error: { code, message } });

const normCode = (code: string) => code.trim().toUpperCase();
const startsAtOf = (date: string | null) => (date ? startOfDayKL(date).toISOString() : null);
const expiresAtOf = (date: string | null) => (date ? endOfDayKL(date).toISOString() : null);
const dayText = (instant: string | null, none: string) => (instant ? fmtDate(instant) : none);
const limitText = (limit: number | null, used: number) => (limit === null ? "No limit" : `Up to ${limit} uses (${used} used so far)`);

/** An amount in the merchant's units to the stored value: whole percent 1–100, or RM with up to 2 decimals → sen. */
function stored(type: "percentage" | "fixed", amount: number): { value: number } | Refusal {
	if (type === "percentage") {
		return Number.isInteger(amount) && amount >= 1 && amount <= 100 ? { value: amount } : refuse("invalid_amount", "A percentage discount is a whole number from 1 to 100.");
	}
	const sen = Math.round(amount * 100);
	if (Math.abs(sen - amount * 100) > 1e-6) return refuse("invalid_amount", "An amount in RM has at most 2 decimals (sen).");
	if (sen < 1 || sen > MAX_FIXED_DISCOUNT_SEN) return refuse("invalid_amount", `A fixed discount is from RM 0.01 to RM ${MAX_FIXED_DISCOUNT_RM.toLocaleString("en-MY")}.`);
	return { value: sen };
}

export async function prepareStoreDiscounts(actor: AgentActor, raw: unknown, now: Date = new Date()): Promise<PreparedSiteChange | Refusal> {
	const input = StoreDiscountsChangeSchema.parse(raw);
	const denied = discountsRefusal(actor);
	if (denied) return denied;
	const cms = await getPayload({ config });
	const [{ rows: current }, sites] = await Promise.all([tenantDiscounts(cms, actor), tenantSites(cms, actor)]);
	const original = new Map(current.map((r) => [r.id, r]));

	// the discounts as they will be, step by step: new ones get negative ids
	const rows = new Map(current.map((r) => [r.id, { ...r }]));
	const codes = new Map(current.map((r) => [normCode(r.code), r.id]));
	let nextNew = -1;
	const steps: PlannedDiscountStep[] = [];
	const diffs: PreparedSiteChange["diffs"] = [];
	const touched = new Set<number>();
	const deleted: string[] = [];
	const notes: string[] = [];
	let liveChange = false;
	let created = 0;
	let changed = 0;

	/** One heading per discount in the card: its code and how it stands before this change. */
	const label = (id: number) => {
		const row = original.get(id);
		return row ? `${row.code} · ${describeDiscount(row, now)}` : String(id);
	};
	const siteName = (id: number | null) => (id === null ? "All sites" : (sites.get(id) ?? `Site ${id}`));
	const siteProblem = (siteId: string | null | undefined): Refusal | null =>
		siteId && !sites.has(Number(siteId)) ? refuse("unknown_site", `Site ${siteId} is not in this store${sites.size > 0 ? `: ${[...sites].map(([id, name]) => `${id} ${name}`).join(", ")}` : ""}.`) : null;

	for (const step of input.changes) {
		if (step.op === "create") {
			const code = normCode(step.code);
			const taken = codes.get(code);
			if (taken !== undefined) {
				const row = rows.get(taken);
				return refuse("code_taken", `The code ${code} already exists${row && taken > 0 ? ` (id ${taken}: ${describeDiscount(row, now)})` : " in this change"}. Change that one, or pick another code.`);
			}
			const amount = stored(step.type, step.amount);
			if ("error" in amount) return amount;
			const wrongSite = siteProblem(step.siteId);
			if (wrongSite) return wrongSite;
			const status = step.status === "paused" ? "inactive" : "active";
			const startsOn = step.startsOn ?? null;
			const endsOn = step.endsOn ?? null;
			const problem = candidateProblem({ code, description: step.description ?? null, type: step.type, value: amount.value, usageLimit: step.usageLimit ?? null, startsOn, endsOn, status });
			if (problem) return refuse("invalid_input", problem);
			const row: DiscountRow = {
				id: nextNew--,
				code,
				description: step.description || null,
				type: step.type,
				value: amount.value,
				status,
				usageLimit: step.usageLimit ?? null,
				usageCount: 0,
				startsAt: startsAtOf(startsOn),
				expiresAt: expiresAtOf(endsOn),
				site: step.siteId ? Number(step.siteId) : null,
				updatedAt: "",
			};
			if (status === "active") {
				const blocked = activationProblem(row, now);
				if (blocked) return refuse(blocked.code, blocked.message);
				liveChange = true;
			}
			rows.set(row.id, row);
			codes.set(code, row.id);
			const entity = { kind: "store_discount", id: `new:${row.id}`, label: code };
			diffs.push({ entity, field: "New discount", before: null, after: describeDiscount(row, now) });
			if (row.site !== null) diffs.push({ entity, field: "Applies to", before: null, after: siteName(row.site) });
			if (row.description) diffs.push({ entity, field: "Description", before: null, after: row.description });
			created += 1;
			steps.push({ op: "create", data: { code, description: row.description, type: row.type, value: row.value, status, usageLimit: row.usageLimit, startsAt: startsOn, expiresAt: endsOn, site: row.site } });
			continue;
		}

		const id = Number(step.discountId);
		const row = rows.get(id);
		if (!row || id < 0) return refuse("unknown_discount", `Discount ${step.discountId} is not in this store (read store_discounts for ids).`);
		const entity = { kind: "store_discount", id: String(id), label: label(id) };

		if (step.op === "delete") {
			diffs.push({ entity, field: "Deleted", before: row.usageCount > 0 ? `Used ${row.usageCount} time${row.usageCount === 1 ? "" : "s"}` : null, after: "Deleted — the code stops working" });
			rows.delete(id);
			codes.delete(normCode(row.code));
			touched.add(id);
			deleted.push(row.code);
			steps.push({ op: "delete", discountId: id });
			continue;
		}

		if (step.op === "activate" || step.op === "pause") {
			const next = step.op === "activate" ? "active" : "inactive";
			if (row.status === next) {
				notes.push(`${row.code} is already ${next === "active" ? "switched on" : "paused"}${next === "active" && effectiveOf(row, now) !== "active" ? ` but not live (${describeDiscount(row, now)})` : ""}.`);
				continue;
			}
			if (next === "active") {
				const blocked = activationProblem(row, now);
				if (blocked) return refuse(blocked.code, blocked.message);
				liveChange = true;
			}
			const future = next === "active" && row.startsAt && new Date(row.startsAt) > now ? ` (starts ${fmtDate(row.startsAt)})` : "";
			diffs.push({ entity, field: "Status", before: row.status === "active" ? "Active" : "Inactive", after: `${next === "active" ? "Active" : "Inactive (paused)"}${future}` });
			row.status = next;
			touched.add(id);
			changed += 1;
			steps.push({ op: "update", discountId: id, data: { status: next } });
			continue;
		}

		// update
		const wasActive = row.status === "active";
		const patch: Partial<DiscountWrite> = {};
		const rowsOut: PreparedSiteChange["diffs"] = [];
		const before = { ...row };
		const clash = (flag: boolean | null | undefined, value: unknown, what: string) => (flag && value != null ? refuse("invalid_input", `Step for ${row.code}: ${what} — give a value or remove it, not both.`) : null);
		const conflict = clash(step.removeLimit, step.usageLimit, "usage limit") ?? clash(step.removeStart, step.startsOn, "start date") ?? clash(step.removeEnd, step.endsOn, "end date") ?? clash(step.allSites, step.siteId, "site");
		if (conflict) return conflict;

		if (step.code && normCode(step.code) !== row.code) {
			const code = normCode(step.code);
			if (codes.has(code)) return refuse("code_taken", `The code ${code} already exists. Pick another code.`);
			codes.delete(normCode(row.code));
			codes.set(code, id);
			row.code = code;
			patch.code = code;
			rowsOut.push({ entity, field: "Code", before: before.code, after: code });
		}
		if (step.type || step.amount != null) {
			const type = step.type ?? row.type;
			if (step.amount == null && type !== row.type) return refuse("amount_needed", `Changing ${row.code} between % and RM needs the new amount too.`);
			const amount = step.amount != null ? stored(type, step.amount) : { value: row.value };
			if ("error" in amount) return amount;
			if (type !== row.type || amount.value !== row.value) {
				if (type !== row.type) patch.type = type;
				patch.value = amount.value;
				row.type = type;
				row.value = amount.value;
				rowsOut.push({ entity, field: "Discount", before: valueText(before.type, before.value), after: valueText(type, amount.value) });
			}
		}
		if (step.description != null && (step.description || null) !== row.description) {
			row.description = step.description || null;
			patch.description = row.description;
			rowsOut.push({ entity, field: "Description", before: before.description, after: row.description ?? "(empty)" });
		}
		const limit = step.removeLimit ? null : (step.usageLimit ?? row.usageLimit);
		if (limit !== row.usageLimit) {
			row.usageLimit = limit;
			patch.usageLimit = limit;
			rowsOut.push({ entity, field: "Usage limit", before: limitText(before.usageLimit, row.usageCount), after: limitText(limit, row.usageCount) });
		}
		const startsOn = step.removeStart ? null : (step.startsOn ?? (row.startsAt ? klDateKey(row.startsAt) : null));
		if (startsOn !== (row.startsAt ? klDateKey(row.startsAt) : null)) {
			row.startsAt = startsAtOf(startsOn);
			patch.startsAt = startsOn;
			rowsOut.push({ entity, field: "Starts", before: dayText(before.startsAt, "Right away"), after: dayText(row.startsAt, "Right away") });
		}
		const endsOn = step.removeEnd ? null : (step.endsOn ?? (row.expiresAt ? klDateKey(row.expiresAt) : null));
		if (endsOn !== (row.expiresAt ? klDateKey(row.expiresAt) : null)) {
			row.expiresAt = expiresAtOf(endsOn);
			patch.expiresAt = endsOn;
			rowsOut.push({ entity, field: "Ends", before: dayText(before.expiresAt, "No end date"), after: dayText(row.expiresAt, "No end date") });
		}
		const site = step.allSites ? null : step.siteId ? Number(step.siteId) : row.site;
		if (site !== row.site) {
			const wrongSite = siteProblem(step.siteId);
			if (wrongSite) return wrongSite;
			row.site = site;
			patch.site = site;
			rowsOut.push({ entity, field: "Applies to", before: siteName(before.site), after: siteName(site) });
		}
		if (rowsOut.length === 0) {
			notes.push(`${row.code} already is as asked.`);
			continue;
		}
		const problem = candidateProblem({ code: row.code, description: row.description, type: row.type, value: row.value, usageLimit: row.usageLimit, startsOn: row.startsAt ? klDateKey(row.startsAt) : null, endsOn: row.expiresAt ? klDateKey(row.expiresAt) : null, status: row.status });
		if (problem) return refuse("invalid_input", `${row.code}: ${problem}`);
		// the form blocks saving an active code whose end date or limit would make it unusable
		if (wasActive && (patch.expiresAt !== undefined || patch.usageLimit !== undefined)) {
			const blocked = activationProblem(row, now);
			if (blocked) return refuse(blocked.code, blocked.message);
		}
		// a description alone changes nothing at checkout
		if (wasActive && Object.keys(patch).some((key) => key !== "description")) liveChange = true;
		diffs.push(...rowsOut);
		touched.add(id);
		changed += 1;
		steps.push({ op: "update", discountId: id, data: patch });
	}

	if (diffs.length === 0) return refuse("no_change", notes.length > 0 ? `Nothing would change: ${notes.join(" ")}` : "Nothing would change: the discounts are already as asked.");

	const base: StoreDiscountsPlan["base"] = Object.fromEntries([...touched].map((id) => [String(id), original.get(id)!.updatedAt]));
	const codesOf = (list: string[]) => list.slice(0, 3).join(", ");
	const firstCode = (() => {
		const first = steps[0]!;
		return first.op === "create" ? first.data.code : (original.get(first.discountId)?.code ?? "");
	})();
	const single = steps.length === 1;
	const title =
		deleted.length > 0 && single
			? `Delete discount: ${deleted[0]}`
			: single && steps[0]!.op === "create"
				? `New discount: ${firstCode}`
				: single && steps[0]!.op === "update" && Object.keys(steps[0].data).join() === "status"
					? `${(steps[0].data as { status?: string }).status === "active" ? "Switch on" : "Pause"} discount: ${firstCode}`
					: single
						? `Change discount: ${firstCode}`
						: created > 0 && changed === 0 && deleted.length === 0
							? `${created} new discounts`
							: `Change ${steps.length} discounts`;
	const guardrails: PreparedSiteChange["guardrails"] = [
		{ rule: "same_rules", ok: true, detail: "Same rules as Discounts: one code per store, a percentage up to 100, an end date after the start." },
		{ rule: "undo", ok: true, detail: "You can undo it for 7 days while nobody edits these discounts." },
	];
	if (liveChange) guardrails.push({ rule: "live", ok: true, detail: "An active discount applies at checkout at once." });
	if (deleted.length > 0) {
		const used = [...touched].map((id) => original.get(id)).filter((r): r is DiscountRow => Boolean(r) && !rows.has(r!.id) && r!.usageCount > 0);
		guardrails.push({ rule: "undo", ok: true, detail: `Orders already placed keep what they paid.${used.length > 0 ? ` ${codesOf(used.map((r) => r.code))} ${used.length === 1 ? "was" : "were"} used: undo brings the code back, but not its link to those orders.` : ""}` });
	}
	return {
		kind: "store.discounts_patch",
		title,
		why: input.why,
		risk: deleted.length > 0 ? "high" : liveChange ? "medium" : "low",
		diffs,
		guardrails,
		// deleting a code: the card asks Yes / No (the codes are echoed back as the confirm)
		...(deleted.length > 0 ? { confirmText: deleted.join(", ").slice(0, 200) } : {}),
		// a code that goes live (or changes while live) is money off at checkout: Auto-approve never applies it
		...(liveChange ? { requiresClick: true } : {}),
		plan: { steps, base } satisfies StoreDiscountsPlan,
	};
}
