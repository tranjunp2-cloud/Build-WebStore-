import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import { planAllowsTemplates } from "@/lib/email/template-settings-service";
import { getLeadAs, LEAD_DB_TO_DISPLAY, LEAD_DISPLAY_TO_DB, type LeadDbStatus, type LeadDisplayStatus } from "@/lib/leads/lead-service";
import { cleanSubject, leadReplyContext, leadReplyProblem, MAX_REPLIES_PER_DAY, MAX_REPLIES_PER_HOUR } from "@/lib/leads/lead-reply";
import type { AgentActor } from "../context";
import type { PreparedSiteChange } from "../site/site-prepare";
import { crmRefusal } from "./store-customers-access";
import { writeRefusal } from "./store-write-access";
import { type CustomerRankWord, tenantCustomer } from "./store-customers";
import { type PlannedTemplateStep, refuse, type Refusal, draftTemplateStep, type TemplateState } from "./store-templates-prepare";
import { rowKey, tenantTemplateRows } from "./store-email-templates";
import type { EmailTemplateType } from "@/lib/email/types";

/**
 * Drafts (never writes) a card for the customer tools, up to 10 steps: a customer's rank / name / internal
 * note, a contact lead's status, ONE email reply to a lead, and email-template wording (store-templates-prepare).
 * The applier (appliers/store-customers.ts) re-checks the version of everything touched and runs the same
 * write cores as the dashboard pages, as the approver. A reply is the only thing here that can't be undone.
 */

export const MAX_CUSTOMER_STEPS = 10;
const MAX_NOTES = 2000;
const MAX_FIELD_INPUT = 5000;

const Id = z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(z.string().regex(/^[1-9]\d{0,9}$/, "an id (digits)"));
const Template = z.string().min(1).max(60);

export const StoreCustomersStepSchema = z.discriminatedUnion("op", [
	z.object({ op: z.literal("customer_update"), customerId: Id, name: z.string().trim().min(1).max(200).nullish(), rank: z.enum(["bronze", "silver", "gold", "vip"]).nullish(), removeRank: z.boolean().nullish(), notes: z.string().max(MAX_NOTES).nullish() }),
	z.object({ op: z.literal("lead_status"), leadId: Id, status: z.enum(["new", "read", "contacted", "ignored"]) }),
	z.object({ op: z.literal("lead_reply"), leadId: Id, subject: z.string().min(1).max(200), body: z.string().min(1).max(MAX_FIELD_INPUT) }),
	z.object({
		op: z.literal("template_edit"),
		templateType: Template,
		locale: z.enum(["en", "ms"]),
		// the limits are checked per field with a message the model can act on (store-templates-prepare)
		subject: z.string().max(MAX_FIELD_INPUT).nullish(),
		greeting: z.string().max(MAX_FIELD_INPUT).nullish(),
		ctaLabel: z.string().max(MAX_FIELD_INPUT).nullish(),
		closing: z.string().max(MAX_FIELD_INPUT).nullish(),
		enabled: z.boolean().nullish(),
	}),
	z.object({ op: z.literal("template_reset"), templateType: Template }),
]);

export const StoreCustomersChangeSchema = z.object({
	why: z.string().trim().min(1).max(300),
	changes: z.array(StoreCustomersStepSchema).min(1).max(MAX_CUSTOMER_STEPS),
});

export type PlannedCustomersStep =
	| { op: "customer"; customerId: number; data: { name?: string; rank?: CustomerRankWord | null; notes?: string | null } }
	| { op: "lead_status"; leadId: number; status: LeadDbStatus }
	| { op: "lead_reply"; leadId: number; subject: string; body: string; to: string }
	| PlannedTemplateStep;

export type StoreCustomersPlan = {
	steps: PlannedCustomersStep[];
	/** updatedAt of everything the card touches ("customer:12", "lead:5", "template:order-confirmation"): anything edited since is not overwritten */
	base: Record<string, string>;
};

type Diff = PreparedSiteChange["diffs"][number];
const LEAD_WORDS: Record<LeadDisplayStatus, string> = { new: "New", read: "Read", contacted: "Contacted", ignored: "Ignored" };
const RANK_WORDS: Record<string, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", vip: "VIP" };
const rankWord = (rank: string | null) => (rank ? (RANK_WORDS[rank] ?? rank) : "No rank");

export async function prepareStoreCustomers(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | Refusal> {
	const input = StoreCustomersChangeSchema.parse(raw);
	const cms = await getPayload({ config });

	// each area the card touches needs the merchant's role to have it
	const areas = new Set(input.changes.map((c) => (c.op === "customer_update" ? "customers" : c.op.startsWith("lead_") ? "leads" : "email_templates") as "customers" | "leads" | "email_templates"));
	for (const area of areas) {
		const denied = crmRefusal(actor, area);
		if (denied) return denied;
	}
	// an email to a visitor and the wording of the shop's buyer emails: owner / admin / editor (or a custom role with Settings) only, never a viewer
	if (input.changes.some((c) => c.op === "lead_reply")) {
		const denied = writeRefusal(actor, "leads");
		if (denied) return denied;
	}
	if (input.changes.some((c) => c.op === "template_edit" || c.op === "template_reset")) {
		const denied = writeRefusal(actor, "settings");
		if (denied) return denied;
	}
	if (input.changes.filter((c) => c.op === "lead_reply").length > 1) {
		return refuse("one_reply_per_card", "Only one email reply per card: stage the reply to each lead as its own card.");
	}

	const replied = new Set(input.changes.flatMap((c) => (c.op === "lead_reply" ? [c.leadId] : [])));
	const clash = input.changes.find((c) => c.op === "lead_status" && replied.has(c.leadId));
	if (clash) return refuse("reply_sets_status", "An email reply already marks that lead as contacted: drop the status step for it.");

	const customers = new Map<number, NonNullable<Awaited<ReturnType<typeof tenantCustomer>>>>();
	const leadStatus = new Map<number, LeadDisplayStatus>();
	const templateRows = areas.has("email_templates") ? await tenantTemplateRows(cms, actor.tenantId) : new Map();
	const templates: TemplateState = new Map([...templateRows].map(([key, row]) => [key, row]));
	const canEditTemplates = areas.has("email_templates") ? await planAllowsTemplates(cms, actor.tenantId).catch(() => false) : true;

	const steps: PlannedCustomersStep[] = [];
	const diffs: Diff[] = [];
	const notes: string[] = [];
	const base: Record<string, string> = {};
	const touchedTemplates = new Set<EmailTemplateType>();
	const templateOut = { diffs, steps: [] as PlannedTemplateStep[], notes, touched: touchedTemplates };
	let reply: { name: string; to: string } | null = null;
	let replyTo: string | null = null;
	let disabled = false;
	const customerIds = new Set<number>();
	const leadIds = new Set<number>();

	for (const step of input.changes) {
		if (step.op === "customer_update") {
			const id = Number(step.customerId);
			const row = customers.get(id) ?? (await tenantCustomer(cms, actor, id));
			if (!row) return refuse("unknown_customer", `Customer ${step.customerId} is not in this workspace (read store_customers view customers for ids).`);
			if (step.rank && step.removeRank) return refuse("invalid_input", `Customer ${row.name}: give a rank or removeRank, not both.`);
			base[`customer:${id}`] ??= row.updatedAt;
			const entity = { kind: "store_customer", id: String(id), label: `${row.name}${row.email ? ` · ${row.email}` : ""}` };
			const data: { name?: string; rank?: CustomerRankWord | null; notes?: string | null } = {};
			const lines: Diff[] = [];
			if (step.name != null && step.name.trim() !== row.name) {
				data.name = step.name.trim();
				lines.push({ entity, field: "Name", before: row.name, after: data.name });
			}
			const nextRank = step.removeRank ? null : (step.rank ?? row.rank);
			if (nextRank !== row.rank) {
				data.rank = nextRank;
				lines.push({ entity, field: "Rank", before: rankWord(row.rank), after: rankWord(nextRank) });
			}
			if (step.notes != null) {
				const notesNext = step.notes.trim() || null;
				if (notesNext !== row.notes) {
					data.notes = notesNext;
					lines.push({ entity, field: "Internal note", before: row.notes, after: notesNext ?? "(cleared)" });
				}
			}
			if (lines.length === 0) {
				notes.push(`${row.name} already is as asked.`);
				continue;
			}
			diffs.push(...lines);
			customers.set(id, { ...row, ...(data.name ? { name: data.name } : {}), ...("rank" in data ? { rank: data.rank ?? null } : {}), ...("notes" in data ? { notes: data.notes ?? null } : {}) });
			steps.push({ op: "customer", customerId: id, data });
			customerIds.add(id);
			continue;
		}

		if (step.op === "lead_status" || step.op === "lead_reply") {
			const id = Number(step.leadId);
			let lead: Record<string, unknown>;
			try {
				({ lead } = await getLeadAs(actor, id));
			} catch {
				return refuse("unknown_lead", `Lead ${step.leadId} is not in this workspace (read store_customers view leads for ids).`);
			}
			base[`lead:${id}`] ??= String(lead.updatedAt ?? "");
			const name = String(lead.name ?? "");
			const email = String(lead.email ?? "");
			const current = leadStatus.get(id) ?? LEAD_DB_TO_DISPLAY[String(lead.status ?? "new")] ?? "new";
			const entity = { kind: "contact_lead", id: String(id), label: `Lead: ${name} · ${email}` };

			if (step.op === "lead_status") {
				if (current === step.status) {
					notes.push(`${name} is already ${LEAD_WORDS[current].toLowerCase()}.`);
					continue;
				}
				diffs.push({ entity, field: "Status", before: LEAD_WORDS[current], after: LEAD_WORDS[step.status] });
				leadStatus.set(id, step.status);
				steps.push({ op: "lead_status", leadId: id, status: LEAD_DISPLAY_TO_DB[step.status] });
				leadIds.add(id);
				continue;
			}

			const subject = cleanSubject(step.subject);
			const body = step.body.replace(/\r\n?/g, "\n").trim();
			if (!subject || !body) return refuse("invalid_input", "A reply needs a subject and a text.");
			let context: Awaited<ReturnType<typeof leadReplyContext>>;
			try {
				context = await leadReplyContext({ tenantId: actor.tenantId, user: actor.user as unknown as { email: string } }, id);
			} catch {
				return refuse("unknown_lead", `Lead ${step.leadId} is not in this workspace.`);
			}
			if (!/^[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+$/.test(email)) return refuse("no_email", `${name || "This lead"} has no usable email address, so there is nobody to reply to.`);
			// the body goes to an address anyone can type into the contact form: no other people's contact details, kept short (lead-reply-guard)
			const problem = leadReplyProblem(body, context);
			if (problem) return refuse("reply_not_allowed", problem);
			const replyEntity = { kind: "lead_reply", id: `reply:${id}`, label: `Email to ${name || email}` };
			diffs.push(
				{ entity: replyEntity, field: "To", before: null, after: `${name} <${email}>` },
				{ entity: replyEntity, field: "Subject", before: null, after: subject },
				{ entity: replyEntity, field: "Message", before: null, after: body },
			);
			if (current !== "contacted") {
				diffs.push({ entity, field: "Status", before: LEAD_WORDS[current], after: `${LEAD_WORDS.contacted} (once the email is sent)` });
				leadStatus.set(id, "contacted");
			}
			steps.push({ op: "lead_reply", leadId: id, subject, body, to: email });
			reply = { name, to: email };
			leadIds.add(id);
			replyTo = context.replyTo ? `${context.replyTo} (${context.replyToIs === "shop" ? "the shop's contact email" : "your account email: the shop has no contact email set"})` : null;
			continue;
		}

		const refusal = draftTemplateStep(step, templates, templateOut, { canEdit: canEditTemplates });
		if (refusal) return refusal;
		if (step.op === "template_edit" && step.enabled === false) disabled = true;
	}
	steps.push(...templateOut.steps);
	// the email goes last: everything else is done (and can be put back) before it is sent
	steps.sort((a, b) => Number(a.op === "lead_reply") - Number(b.op === "lead_reply"));
	for (const type of touchedTemplates) base[`template:${type}`] = templateRows.get(rowKey(type))?.updatedAt ?? "none";

	if (diffs.length === 0) return refuse("no_change", notes.length > 0 ? `Nothing would change: ${notes.join(" ")}` : "Nothing would change: it is already as asked.");

	const single = steps.length === 1 ? steps[0]! : null;
	const title = single
		? single.op === "customer"
			? `Customer: ${customers.get(single.customerId)?.name ?? single.customerId}`
			: single.op === "lead_reply"
				? `Reply to ${reply?.name || reply?.to}`
				: single.op === "lead_status"
					? "Lead status"
					: single.op === "template_reset"
						? "Reset an email template"
						: "Email template wording"
		: [customerIds.size > 0 ? `${customerIds.size} customer${customerIds.size === 1 ? "" : "s"}` : null, leadIds.size > 0 ? `${leadIds.size} lead${leadIds.size === 1 ? "" : "s"}` : null, touchedTemplates.size > 0 ? `${touchedTemplates.size} email template${touchedTemplates.size === 1 ? "" : "s"}` : null].filter(Boolean).join(", ");
	const guardrails: PreparedSiteChange["guardrails"] = [];
	if (customerIds.size + leadIds.size + touchedTemplates.size > 0) guardrails.push({ rule: "undo", ok: true, detail: reply ? "You can undo the other changes for 7 days while nobody edits them." : "You can undo it for 7 days while nobody edits these records." });
	if (reply) {
		guardrails.push({ rule: "live", ok: true, detail: `The email is sent to ${reply.to} as soon as you approve, exactly as written above. It can't be taken back: undo only puts the lead's status back. Replies come back to ${replyTo ?? "the sender address"}. Up to ${MAX_REPLIES_PER_HOUR} replies an hour and ${MAX_REPLIES_PER_DAY} a day.` });
	}
	if (touchedTemplates.size > 0) guardrails.push({ rule: "live", ok: true, detail: disabled ? "Emails you switch off stop being sent at once." : "New emails use this wording at once; emails already sent don't change." });

	return {
		kind: "store.customers_patch",
		title,
		why: input.why,
		risk: reply ? "high" : disabled ? "medium" : touchedTemplates.size > 0 ? "medium" : "low",
		diffs,
		guardrails,
		// sending an email can't be taken back: the card asks Yes / No, so auto-approve never sends one
		...(reply ? { confirmText: reply.to.slice(0, 200) } : {}),
		// template wording changes what every buyer reads at once: the merchant clicks Approve, Auto-approve never does
		...(touchedTemplates.size > 0 ? { requiresClick: true } : {}),
		plan: { steps, base } satisfies StoreCustomersPlan,
	};
}
