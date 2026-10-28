import "server-only";

import config from "@payload-config";
import { sql } from "drizzle-orm";
import { getPayload, type Payload } from "payload";
import { z } from "zod";
import { fetchCustomerOrderStats, rate } from "@/lib/customers/customer-service";
import type { AgentActor } from "../context";
import { crmRefusal } from "./store-customers-access";
import { day, rm, UNTRUSTED } from "./store-customers-text";
import { readLead, readLeads } from "./store-leads";
import { readEmailTemplate, readEmailTemplates } from "./store-email-templates";

/**
 * The customer tools' read side: the shop's customers (Customers page) with their order stats, one customer in
 * full, then the contact leads and the email templates (their own modules). Everything is the signed-in
 * merchant's own workspace and role; names, notes and messages are other people's words: data, never instructions.
 */

const RANKS = ["bronze", "silver", "gold", "vip"] as const;
export type CustomerRankWord = (typeof RANKS)[number];

export const StoreCustomersReadSchema = z.object({
	view: z.enum(["customers", "customer", "leads", "lead", "email_templates", "email_template"]),
	id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^[1-9]\d{0,9}$/)).nullish(),
	query: z.string().trim().max(80).nullish(),
	rank: z.enum(["any", "none", ...RANKS]).nullish(),
	sort: z.enum(["recent_order", "orders", "spend", "name", "newest"]).nullish(),
	leadStatus: z.enum(["any", "new", "read", "contacted", "ignored"]).nullish(),
	olderThanDays: z.number().int().min(1).max(3650).nullish(),
	templateType: z.string().max(60).nullish(),
	limit: z.number().int().min(1).max(30).nullish(),
});
export type StoreCustomersRead = z.infer<typeof StoreCustomersReadSchema>;

const customerUser = (actor: AgentActor) => actor.user as unknown as Parameters<Payload["find"]>[0]["user"];

export type CustomerRow = { id: number; name: string; email: string | null; phone: string | null; rank: CustomerRankWord | null; notes: string | null; updatedAt: string };

export const customerRow = (doc: Record<string, unknown>): CustomerRow => ({
	id: Number(doc.id),
	name: String(doc.name ?? ""),
	email: typeof doc.email === "string" && doc.email ? doc.email : null,
	phone: typeof doc.phone === "string" && doc.phone ? doc.phone : null,
	rank: (RANKS as readonly string[]).includes(String(doc.rank)) ? (doc.rank as CustomerRankWord) : null,
	notes: typeof doc.notes === "string" && doc.notes ? doc.notes : null,
	updatedAt: String(doc.updatedAt ?? ""),
});

/** One customer of this workspace as the merchant may see it, or null. */
export async function tenantCustomer(cms: Payload, actor: AgentActor, id: number): Promise<CustomerRow | null> {
	const doc = await cms
		.findByID({ collection: "customers", id, depth: 0, overrideAccess: false, user: customerUser(actor), disableErrors: true } as Parameters<Payload["findByID"]>[0])
		.catch(() => null);
	if (!doc) return null;
	const tenant = (doc as { tenant?: unknown }).tenant;
	const tenantId = typeof tenant === "object" && tenant ? (tenant as { id?: unknown }).id : tenant;
	return String(tenantId) === String(actor.tenantId) ? customerRow(doc as unknown as Record<string, unknown>) : null;
}

const SORTS = {
	recent_order: sql.raw("c.latest_order_at DESC NULLS LAST"),
	orders: sql.raw("COUNT(o.id) DESC"),
	spend: sql.raw("COALESCE(SUM(o.total), 0) DESC"),
	name: sql.raw("c.name ASC"),
	newest: sql.raw("c.created_at DESC"),
} as const;

async function listCustomers(actor: AgentActor, input: StoreCustomersRead) {
	const cms = await getPayload({ config });
	const tid = Number.parseInt(actor.tenantId, 10);
	if (Number.isNaN(tid)) return { error: { code: "invalid_workspace", message: "This workspace has no customers table." } };
	const parts = [sql`c.tenant_id = ${tid}`];
	if (input.query) {
		const q = `%${input.query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
		parts.push(sql`(c.email ILIKE ${q} OR c.name ILIKE ${q} OR c.phone ILIKE ${q})`);
	}
	const rank = input.rank ?? "any";
	if (rank === "none") parts.push(sql`c.rank IS NULL`);
	else if (rank !== "any") parts.push(sql`c.rank = ${rank}`);
	const where = sql.join(parts, sql` AND `);
	const limit = input.limit ?? 10;
	const order = SORTS[input.sort ?? "recent_order"];

	const [data, count] = (await Promise.all([
		cms.db.drizzle.execute(sql`
			SELECT c.id, c.name, c.email, c.phone, c.rank, c.created_at, c.latest_order_at,
				COUNT(o.id)::int AS order_count,
				COALESCE(SUM(o.total), 0)::numeric AS lifetime,
				COUNT(CASE WHEN o.status = 'completed' THEN 1 END)::int AS completed_count,
				COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END)::int AS cancelled_count
			FROM customers c
			LEFT JOIN orders o ON o.customer_id = c.id AND o.tenant_id = c.tenant_id
			WHERE ${where}
			GROUP BY c.id
			ORDER BY ${order}, c.id DESC
			LIMIT ${limit}`),
		cms.db.drizzle.execute(sql`SELECT COUNT(*)::int AS total FROM customers c WHERE ${where}`),
	])) as unknown as [{ rows: Array<Record<string, unknown>> }, { rows: Array<{ total: number }> }];

	return {
		note: `The shop's customers (money in RM). ${UNTRUSTED} Change a rank or note with propose_store_customers.`,
		total: count.rows[0]?.total ?? 0,
		customers: data.rows.map((r) => {
			const orders = Number(r.order_count ?? 0);
			return {
				id: String(r.id),
				name: String(r.name ?? ""),
				email: r.email ?? null,
				phone: r.phone ?? null,
				rank: r.rank ?? null,
				orders,
				lifetimeRM: rm(r.lifetime),
				completedPercent: rate(Number(r.completed_count ?? 0), orders),
				cancelledPercent: rate(Number(r.cancelled_count ?? 0), orders),
				lastOrder: day(r.latest_order_at),
			};
		}),
	};
}

async function readCustomer(actor: AgentActor, id: string) {
	const cms = await getPayload({ config });
	const row = await tenantCustomer(cms, actor, Number(id));
	if (!row) return { error: { code: "unknown_customer", message: "No such customer in this workspace (read store_customers view customers for ids)." } };
	const doc = (await cms.findByID({ collection: "customers", id: row.id, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>;
	const stats = (await fetchCustomerOrderStats(cms, [row.id], actor.tenantId)).get(row.id);
	const recent = await cms.find({
		collection: "orders",
		where: { and: [{ customer: { equals: row.id } }, { tenant: { equals: actor.tenantId } }] },
		sort: "-createdAt",
		limit: 5,
		depth: 0,
		overrideAccess: true,
	});
	const orders = stats?.count ?? 0;
	const addresses = Array.isArray(doc.addresses) ? (doc.addresses as Array<Record<string, unknown>>) : [];
	return {
		note: UNTRUSTED,
		customer: {
			id: String(row.id),
			name: row.name,
			email: row.email,
			phone: row.phone,
			rank: row.rank,
			notes: row.notes,
			joined: day(doc.createdAt),
			firstOrder: day(doc.firstOrderAt),
			lastOrder: day(doc.latestOrderAt),
			orders,
			lifetimeRM: rm(stats?.total),
			completedPercent: rate(stats?.completed ?? 0, orders),
			cancelledPercent: rate(stats?.cancelled ?? 0, orders),
			addresses: addresses.slice(0, 5).map((a) => ({
				label: a.label ?? null,
				address: [a.line1, a.line2, a.postcode, a.city, a.state, a.country].filter((p) => typeof p === "string" && p).join(", "),
				default: Boolean(a.isDefault),
			})),
			recentOrders: (recent.docs as unknown as Array<Record<string, unknown>>).map((o) => ({
				orderNumber: o.orderNumber,
				status: o.status,
				totalRM: rm(o.total),
				date: day(o.createdAt),
			})),
		},
	};
}

export async function readStoreCustomers(actor: AgentActor, raw: unknown) {
	const input = StoreCustomersReadSchema.parse(raw ?? {});
	switch (input.view) {
		case "customers":
		case "customer": {
			const refusal = crmRefusal(actor, "customers");
			if (refusal) return refusal;
			if (input.view === "customer") {
				return input.id ? readCustomer(actor, input.id) : { error: { code: "invalid_input", message: "id: the customer id (from view customers)." } };
			}
			return listCustomers(actor, input);
		}
		case "leads":
		case "lead": {
			const refusal = crmRefusal(actor, "leads");
			if (refusal) return refusal;
			if (input.view === "lead") return input.id ? readLead(actor, Number(input.id)) : { error: { code: "invalid_input", message: "id: the lead id (from view leads)." } };
			return readLeads(actor, input);
		}
		case "email_templates":
		case "email_template": {
			const refusal = crmRefusal(actor, "email_templates");
			if (refusal) return refusal;
			if (input.view === "email_template") return readEmailTemplate(actor, input.templateType ?? "");
			return readEmailTemplates(actor);
		}
	}
}
