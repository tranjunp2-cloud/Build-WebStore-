import "server-only";

import { tenantRefId } from "@/lib/sites/site-access";
import type { AgentActor } from "../context";

/**
 * Who may CHANGE things that move money or reach buyers and visitors through the copilot: cancel, refund,
 * approve / reject a payment proof, reply to a lead by email, edit an email template.
 *
 * Reading stays as the dashboard has it (`requirePermission`: owner / admin / editor / viewer see every area;
 * a `custom` role only the permissions it holds). The dashboard also lets a `viewer` use these buttons (a legacy
 * shim that keeps old staff working), but the copilot is a new, faster door to the same actions and sends a
 * brand-new kind of email, so it is stricter on writes:
 *   - owner / admin / editor: yes (the area is open to them, as on the dashboard)
 *   - custom: only with the area's permission id (orders → `orders`; email templates → `settings`)
 *   - viewer: never
 * Contact leads have no permission id a custom role can hold, so they are for owner / admin / editor only.
 */

export type WriteArea = "orders" | "settings" | "leads";

const WRITE_ROLES = new Set(["owner", "admin", "editor"]);
const AREA_WORDS: Record<WriteArea, string> = { orders: "cancel, refund or check payments of orders", settings: "edit email templates", leads: "reply to contact leads" };

type Membership = { tenant?: unknown; role?: string; status?: string; permissions?: string[] };

export function canWriteArea(user: unknown, tenantId: string | number, area: WriteArea): boolean {
	const memberships = (user as { tenants?: Membership[] } | null)?.tenants ?? [];
	const membership = memberships.find((m) => tenantRefId(m.tenant) === String(tenantId) && m.status === "active");
	if (!membership) return false;
	const role = membership.role ?? "viewer";
	if (WRITE_ROLES.has(role)) return true;
	if (area === "leads") return false;
	return role === "custom" && Array.isArray(membership.permissions) && membership.permissions.includes(area);
}

/** The refusal in the merchant's words, or null when the actor may write in the area. */
export function writeRefusal(actor: AgentActor, area: WriteArea): { error: { code: string; message: string } } | null {
	return canWriteArea(actor.user, actor.tenantId, area)
		? null
		: { error: { code: "forbidden", message: `Your role in this workspace can look at this but can't ${AREA_WORDS[area]}. Ask the owner or an admin.` } };
}
