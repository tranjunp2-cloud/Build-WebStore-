import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type User } from "payload";
import { z } from "zod";
import { type CustomerRank, updateCustomerAs } from "@/lib/customers/customer-service";
import { resetEmailTemplateConfigAs, saveEmailTemplateConfigAs } from "@/lib/email/template-settings-service";
import { EMAIL_TEMPLATE_TYPES, type EmailTemplateType } from "@/lib/email/types";
import { replyToLeadAs } from "@/lib/leads/lead-reply";
import { getLeadAs, LeadServiceError, leadStatusesUntouchedAs, restoreLeadStatusesAs, setLeadStatusAs } from "@/lib/leads/lead-service";
import type { AgentActor } from "../context";
import { crmRefusal } from "../store/store-customers-access";
import { writeRefusal } from "../store/store-write-access";
import { tenantCustomer } from "../store/store-customers";
import { recipientOf, rowKey, tenantTemplateRows } from "../store/store-email-templates";
import { ChangeSetApplyError, PutBackError, putBack, putBackFailed, staleChange } from "./errors";
import { samePlan } from "./same-plan";
import { until } from "./site-edits";

/**
 * Applies a drafted customer card (`store.customers_patch`): customer rank / name / note, lead status, the one
 * email reply, email-template wording. Each page's own write core runs as the approver, in the drafted
 * workspace, after a version check of everything the card touches. The reply is sent LAST: if anything before
 * it fails, or the mail is refused, what was done is put back and nothing is sent. What each step changed is
 * kept, so undo (`store.customers_restore`) puts it back newest first; a sent email is not part of it.
 */

const CHANGED = "These customers, leads or email templates changed after the assistant drafted this. Ask again.";
const userOf = (actor: AgentActor) => actor.user as unknown as User;

const Text = z.object({ subject: z.string().max(200).optional(), greeting: z.string().max(500).optional(), ctaLabel: z.string().max(100).optional(), closing: z.string().max(2000).optional() });
const Type = z.enum(EMAIL_TEMPLATE_TYPES as unknown as [EmailTemplateType, ...EmailTemplateType[]]);
const Rank = z.enum(["bronze", "silver", "gold", "vip"]);
const LeadDb = z.enum(["new", "read", "replied", "archived"]);
const Plan = z.object({
	steps: z
		.array(
			z.discriminatedUnion("op", [
				z.object({ op: z.literal("customer"), customerId: z.number().int().positive(), data: z.object({ name: z.string().min(1).max(200).optional(), rank: Rank.nullable().optional(), notes: z.string().max(2000).nullable().optional() }) }),
				z.object({ op: z.literal("lead_status"), leadId: z.number().int().positive(), status: LeadDb }),
				z.object({ op: z.literal("lead_reply"), leadId: z.number().int().positive(), subject: z.string().min(1).max(200), body: z.string().min(1).max(4000), to: z.string().min(3).max(320) }),
				z.object({ op: z.literal("template_save"), templateType: Type, enabled: z.boolean(), contentEn: Text, contentMs: Text }),
				z.object({ op: z.literal("template_reset"), templateType: Type }),
			]),
		)
		.min(1)
		.max(10),
	base: z.record(z.string(), z.string()),
});

const Undo = z.object({
	ops: z.array(
		z.discriminatedUnion("op", [
			z.object({ op: z.literal("customer"), id: z.number().int(), updatedAt: z.string(), before: z.object({ name: z.string(), rank: Rank.nullable(), notes: z.string().nullable() }) }),
			z.object({ op: z.literal("lead_status"), items: z.array(z.object({ id: z.number().int(), before: LeadDb, updatedAt: z.string() })).min(1).max(100) }),
			z.object({
				op: z.literal("template"),
				templateType: Type,
				/** the row before (null = there was none) */
				before: z.object({ enabled: z.boolean(), contentEn: Text, contentMs: Text }).nullable(),
				/** the row our write left (null = we deleted it) */
				updatedAt: z.string().nullable(),
			}),
		]),
	),
});
type UndoOp = z.infer<typeof Undo>["ops"][number];

/** One write; the domain's refusals become apply errors the merchant can read. */
async function run<T>(write: () => Promise<T>): Promise<T> {
	try {
		return await write();
	} catch (error) {
		if (error instanceof ChangeSetApplyError) throw error;
		if (error instanceof LeadServiceError) throw new ChangeSetApplyError(error.message, error.code === "RATE_LIMITED" ? 409 : 422);
		if (error instanceof Error && error.message === "Unauthorized") throw new ChangeSetApplyError("That record belongs to another workspace.", 403);
		console.error("[store-customers] write refused:", error instanceof Error ? error.message : error);
		throw new ChangeSetApplyError("The change was refused.", 422);
	}
}

/** Everything the card touches must still be as drafted. */
async function verifyBase(actor: AgentActor, base: Record<string, string>) {
	const cms = await getPayload({ config });
	const rows = Object.keys(base).some((k) => k.startsWith("template:")) ? await tenantTemplateRows(cms, actor.tenantId) : null;
	for (const [key, expected] of Object.entries(base)) {
		const [kind, id] = key.split(":") as [string, string];
		let current: string | null = null;
		if (kind === "customer") current = (await tenantCustomer(cms, actor, Number(id)))?.updatedAt ?? null;
		else if (kind === "lead") current = await getLeadAs(actor, Number(id)).then(({ lead }) => String(lead.updatedAt ?? ""), () => null);
		else if (kind === "template") current = rows?.get(rowKey(id as EmailTemplateType))?.updatedAt ?? "none";
		// changed or gone since the draft: this card can never apply, it is closed with the reason
		if (current !== expected) throw staleChange(CHANGED);
	}
}

/** Role of the approver: the same areas the draft needed. */
function assertAreas(actor: AgentActor, ops: Array<{ op: string }>) {
	const areas = new Set(ops.map((o) => (o.op === "customer" ? "customers" : o.op.startsWith("lead_") ? "leads" : "email_templates") as "customers" | "leads" | "email_templates"));
	for (const area of areas) {
		const denied = crmRefusal(actor, area);
		if (denied) throw new ChangeSetApplyError(denied.error.message, 403);
	}
	// the email reply and the template wording are for owner / admin / editor (or custom with Settings), not a viewer
	const writes: Array<"leads" | "settings"> = [];
	if (ops.some((o) => o.op === "lead_reply")) writes.push("leads");
	if (ops.some((o) => o.op === "template_save" || o.op === "template_reset")) writes.push("settings");
	for (const area of writes) {
		const denied = writeRefusal(actor, area);
		if (denied) throw new ChangeSetApplyError(denied.error.message, 403);
	}
}

const fieldsOf = (g: unknown) => z.object({ subject: z.string().optional(), greeting: z.string().optional(), ctaLabel: z.string().optional(), closing: z.string().optional() }).parse(g ?? {});

export async function applyStoreCustomersPatch(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = Plan.parse(raw);
	assertAreas(actor, plan.steps);
	await verifyBase(actor, plan.base);

	const undo: UndoOp[] = [];
	const entities: Array<{ kind: string; id: string }> = [];
	const tenant = { tenantId: actor.tenantId, user: userOf(actor) };
	const cms = await getPayload({ config });

	try {
		for (const step of plan.steps) {
			if (step.op === "customer") {
				const row = await tenantCustomer(cms, actor, step.customerId);
				if (!row) throw staleChange(CHANGED);
				const saved = await run(() => updateCustomerAs(tenant, step.customerId, step.data as { name?: string; rank?: CustomerRank | null; notes?: string | null }));
				undo.push({ op: "customer", id: step.customerId, updatedAt: String(saved.updatedAt ?? ""), before: { name: row.name, rank: row.rank, notes: row.notes } });
				entities.push({ kind: "store_customer", id: String(step.customerId) });
			} else if (step.op === "lead_status") {
				const { written } = await run(() => setLeadStatusAs({ tenantId: actor.tenantId }, step.leadId, step.status));
				undo.push({ op: "lead_status", items: written.map((w) => ({ id: w.id, before: w.before, updatedAt: w.updatedAt })) });
				entities.push({ kind: "contact_lead", id: String(step.leadId) });
			} else if (step.op === "template_save") {
				const recipient = recipientOf(step.templateType);
				const result = await run(() => saveEmailTemplateConfigAs(tenant, { templateType: step.templateType, recipient, enabled: step.enabled, contentEn: step.contentEn, contentMs: step.contentMs }));
				if (!result.success) throw new ChangeSetApplyError(result.error ?? "The email template change was refused.", 422);
				undo.push({ op: "template", templateType: step.templateType, before: result.before ? { enabled: result.before.enabled, contentEn: result.before.contentEn, contentMs: result.before.contentMs } : null, updatedAt: result.after?.updatedAt ?? null });
				entities.push({ kind: "email_template", id: step.templateType });
			} else if (step.op === "template_reset") {
				const result = await run(() => resetEmailTemplateConfigAs(tenant, step.templateType, recipientOf(step.templateType)));
				if (result.before) undo.push({ op: "template", templateType: step.templateType, before: { enabled: result.before.enabled, contentEn: result.before.contentEn, contentMs: result.before.contentMs }, updatedAt: null });
				entities.push({ kind: "email_template", id: step.templateType });
			} else {
				// the email: last, after the lead is checked to still be this person
				const { lead } = await run(() => getLeadAs(actor, step.leadId));
				if (String(lead.email ?? "").toLowerCase() !== step.to.toLowerCase()) throw staleChange(CHANGED);
				const sent = await run(() => replyToLeadAs({ tenantId: actor.tenantId, user: { email: actor.user.email } }, step.leadId, { subject: step.subject, body: step.body }));
				if (sent.statusWrites.length > 0) undo.push({ op: "lead_status", items: sent.statusWrites.map((w) => ({ id: w.id, before: w.before, updatedAt: w.updatedAt })) });
				entities.push({ kind: "lead_reply", id: String(step.leadId) });
			}
		}
	} catch (error) {
		// nothing was sent (the email is the last step): put back what already ran — and when that fails too, the card
		// closes saying what is still in place
		try {
			await restore(actor, undo);
		} catch (failure) {
			throw putBackFailed("Customers", error, undo.map(describe), failure);
		}
		throw error;
	}

	const customerIds = [...new Set(entities.filter((e) => e.kind === "store_customer").map((e) => e.id))];
	const links = [
		...(customerIds.length === 1 ? [{ label: "Open customer", href: `/customers/${customerIds[0]}` }] : customerIds.length > 1 ? [{ label: "Open customers", href: "/customers" }] : []),
		...(entities.some((e) => e.kind === "contact_lead" || e.kind === "lead_reply") ? [{ label: "Open contact leads", href: "/contact-leads" }] : []),
		...(entities.some((e) => e.kind === "email_template") ? [{ label: "Open email templates", href: "/settings/email-templates" }] : []),
	];
	return { entities, links, ...(undo.length > 0 ? { undo: { kind: "store.customers_restore", payload: { ops: undo }, until: until() } } : {}) };
}

/** What one step did / names, in the merchant's words. */
const subject = (op: UndoOp): string => (op.op === "customer" ? `customer #${op.id}` : op.op === "lead_status" ? "the lead status" : `the ${op.templateType} email template`);
const describe = (op: UndoOp): string => `changed ${subject(op)}`;

/** Newest first. `back`: records already as they were before the change, left alone. */
async function restore(actor: AgentActor, ops: readonly UndoOp[], back: ReadonlySet<string> = new Set()) {
	const tenant = { tenantId: actor.tenantId, user: userOf(actor) };
	for (const op of [...ops].reverse()) {
		if (op.op === "customer") {
			if (!back.has(`customer:${op.id}`)) await putBack(subject(op), () => run(() => updateCustomerAs(tenant, op.id, op.before)));
		} else if (op.op === "lead_status") {
			const items = op.items.filter((item) => !back.has(`lead:${item.id}`));
			if (items.length > 0) await putBack(subject(op), () => run(() => restoreLeadStatusesAs({ tenantId: actor.tenantId }, items)));
		} else if (back.has(`template:${op.templateType}`)) {
			continue;
		} else if (op.before === null) await putBack(subject(op), () => run(() => resetEmailTemplateConfigAs(tenant, op.templateType, recipientOf(op.templateType))));
		else {
			const saved = await putBack(subject(op), () => run(() => saveEmailTemplateConfigAs(tenant, { templateType: op.templateType, recipient: recipientOf(op.templateType), enabled: op.before!.enabled, contentEn: fieldsOf(op.before!.contentEn), contentMs: fieldsOf(op.before!.contentMs) })));
			if (!saved.success) throw new PutBackError(subject(op), new ChangeSetApplyError(saved.error ?? "The email template could not be put back.", 422));
		}
	}
}

/**
 * Before undo changes anything: nobody edited these records since (the newest of our writes to a record is the one
 * that must still stand). Returns the records already back as they were before the change (an undo whose record was
 * lost, a second tab): those are left alone, so a repeated undo succeeds instead of calling them "edited".
 */
async function verifyUndo(actor: AgentActor, ops: readonly UndoOp[]): Promise<Set<string>> {
	const cms = await getPayload({ config });
	const last = new Map<string, string | null>();
	/** the oldest pre-image of each record: what "back as before" means */
	const first = new Map<string, unknown>();
	const remember = (key: string, before: unknown) => {
		if (!first.has(key)) first.set(key, before);
	};
	for (const op of ops) {
		if (op.op === "customer") {
			last.set(`customer:${op.id}`, op.updatedAt);
			remember(`customer:${op.id}`, op.before);
		} else if (op.op === "template") {
			last.set(`template:${op.templateType}`, op.updatedAt);
			remember(`template:${op.templateType}`, op.before);
		} else
			for (const item of op.items) {
				last.set(`lead:${item.id}`, item.updatedAt);
				remember(`lead:${item.id}`, item.before);
			}
	}
	const rows = [...last.keys()].some((k) => k.startsWith("template:")) ? await tenantTemplateRows(cms, actor.tenantId) : null;
	const back = new Set<string>();
	for (const key of last.keys()) {
		const [kind, id] = key.split(":") as [string, string];
		const before = first.get(key);
		if (kind === "customer") {
			const row = await tenantCustomer(cms, actor, Number(id));
			if (row && samePlan({ name: row.name, rank: row.rank, notes: row.notes }, before)) back.add(key);
		} else if (kind === "template") {
			const row = rows?.get(rowKey(id as EmailTemplateType));
			const was = before as { enabled: boolean; contentEn: unknown; contentMs: unknown } | null;
			if (was === null ? !row : row !== undefined && samePlan({ enabled: row.enabled, contentEn: row.contentEn, contentMs: row.contentMs }, was)) back.add(key);
		} else {
			const status = await getLeadAs({ tenantId: actor.tenantId }, Number(id)).then(({ lead }) => String(lead.status ?? ""), () => null);
			if (status !== null && status === before) back.add(key);
		}
	}
	for (const key of back) last.delete(key);
	for (const [key, expected] of last) {
		const [kind, id] = key.split(":") as [string, string];
		if (kind === "customer" && (await tenantCustomer(cms, actor, Number(id)))?.updatedAt !== expected) {
			throw new ChangeSetApplyError("This customer was edited after this change, so it can't be undone safely.", 409);
		}
		if (kind === "template" && (rows?.get(rowKey(id as EmailTemplateType))?.updatedAt ?? null) !== expected) {
			throw new ChangeSetApplyError(`The ${id} email template was edited after this change, so it can't be undone safely.`, 409);
		}
		if (kind === "lead" && !(await run(() => leadStatusesUntouchedAs({ tenantId: actor.tenantId }, [{ id: Number(id), before: "new", updatedAt: expected! }])))) {
			throw new ChangeSetApplyError("A lead was edited after this change, so it can't be undone safely.", 409);
		}
	}
	return back;
}

export async function applyStoreCustomersRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const record = Undo.parse(raw);
	assertAreas(actor, record.ops.map((o) => ({ op: o.op === "template" ? "template_save" : o.op === "lead_status" ? "lead_status" : "customer" })));
	const back = await verifyUndo(actor, record.ops);
	try {
		await restore(actor, record.ops, back);
	} catch (error) {
		if (error instanceof PutBackError) throw error.reason instanceof ChangeSetApplyError ? new ChangeSetApplyError(`${error.what}: ${error.reason.message}`, error.reason.status) : error.reason;
		throw error;
	}
	return { entities: [], links: [] };
}
