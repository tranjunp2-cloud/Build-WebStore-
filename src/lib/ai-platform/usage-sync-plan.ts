import { type SQL, sql } from "drizzle-orm";
import { type ReportsDb, rowsOf } from "@/lib/reports/report-db";
import { isSubscriptionActive } from "@/lib/subscriptions/plan-subscription";

type MainSubscriptionRow = {
	tenant_id: number | string;
	plan: string | null;
	status: string;
	ends_at: string | Date;
	canceled_at: string | Date | null;
	canceled_immediately: boolean | null;
};

/**
 * The plan each tenant is on now: its latest `main` subscription when still active, else FREEMIUM (same rule as
 * plan-limits, so a log row carries the plan its limits came from). The sync runs every 5 min, so for a new row
 * this is the plan at the time of the call. One query per page, only for the page's tenants.
 */
export async function currentPlanByTenant(handle: ReportsDb, tenantIds: ReadonlyArray<number>): Promise<Map<number, string>> {
	const plans = new Map<number, string>();
	const ids = [...new Set(tenantIds)];
	if (ids.length === 0) return plans;
	const list: SQL = sql.join(ids.map((id) => sql`${id}`), sql`, `);
	const rows = await rowsOf<MainSubscriptionRow>(
		handle,
		sql`SELECT DISTINCT ON (tenant_id) tenant_id, plan::text AS plan, status::text AS status, ends_at, canceled_at, canceled_immediately
			FROM plan_subscriptions
			WHERE tenant_id IN (${list}) AND name = 'main'
			ORDER BY tenant_id, created_at DESC`,
	);
	for (const id of ids) plans.set(id, "FREEMIUM");
	for (const row of rows) {
		const active = isSubscriptionActive({
			status: row.status,
			endsAt: row.ends_at,
			canceledAt: row.canceled_at,
			canceledImmediately: row.canceled_immediately,
		});
		if (active && row.plan) plans.set(Number(row.tenant_id), row.plan);
	}
	return plans;
}
