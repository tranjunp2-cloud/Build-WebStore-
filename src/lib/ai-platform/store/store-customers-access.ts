import "server-only";

import { tenantRefId } from "@/lib/sites/site-access";
import type { AgentActor } from "../context";

/**
 * Who may use the customer tools. Same rule as the dashboard pages (`requirePermission` / the Contact leads
 * layout), asked without a redirect: the owner / admin / editor / viewer roles have the area, a custom role
 * only holds what its permissions list. Customers and Contact leads have no permission id a custom role
 * can hold (so they are for the full roles only); Email templates sit under Settings.
 */

export type CrmArea = "customers" | "leads" | "email_templates";

const FULL_ACCESS_ROLES = new Set(["owner", "admin", "editor", "viewer"]);
const CUSTOM_PERMISSION: Record<CrmArea, string | null> = { customers: null, leads: null, email_templates: "settings" };
const AREA_WORDS: Record<CrmArea, string> = { customers: "Customers", leads: "Contact leads", email_templates: "Settings → Email templates" };

export function crmAccess(actor: AgentActor, area: CrmArea): boolean {
	const memberships = (actor.user as unknown as { tenants?: Array<{ tenant?: unknown; role?: string; status?: string; permissions?: string[] }> }).tenants ?? [];
	const membership = memberships.find((m) => tenantRefId(m.tenant) === String(actor.tenantId) && m.status === "active");
	if (!membership) return false;
	const role = membership.role ?? "viewer";
	if (FULL_ACCESS_ROLES.has(role)) return true;
	const needed = CUSTOM_PERMISSION[area];
	return role === "custom" && needed !== null && Array.isArray(membership.permissions) && membership.permissions.includes(needed);
}

/** A refusal the model can pass on, or null when the merchant's role has the area. */
export function crmRefusal(actor: AgentActor, area: CrmArea): { error: { code: string; message: string } } | null {
	return crmAccess(actor, area) ? null : { error: { code: "forbidden", message: `Your role in this workspace can't use ${AREA_WORDS[area]}.` } };
}
