import "server-only";

import config from "@payload-config";
import { getPayload, type User } from "payload";
import { isUsableSite } from "@/lib/dashboard/get-tenant-site-state";
import type { AgentActor } from "../context";
import { SiteToolError } from "./site-read";

/**
 * Website tools called from a page that is not the site editor (the dashboard dock, a campaign) have no site in the
 * Context line, so the model passes `siteId: "auto"`. It means "this workspace's website": the one usable site when
 * there is exactly one (the common case; the same rule as the dashboard's `getTenantSiteState`), otherwise the tool
 * refuses with the list so the model can ask the merchant which one. A real id is never touched.
 */
export const AUTO_SITE_ID = "auto";

const isAuto = (value: unknown): boolean => value === undefined || value === null || (typeof value === "string" && (value.trim() === "" || value.trim().toLowerCase() === AUTO_SITE_ID));

export async function defaultSiteId(actor: AgentActor): Promise<string> {
	const cms = await getPayload({ config });
	const found = await cms.find({
		collection: "sites",
		where: { tenant: { equals: actor.tenantId } },
		limit: 11,
		depth: 0,
		overrideAccess: false,
		user: actor.user as unknown as User,
		pagination: false,
	} as Parameters<typeof cms.find>[0]);
	const sites = (found.docs as unknown as Array<{ id: string | number; name?: string | null; generationStatus?: unknown }>).filter(isUsableSite);
	const [only] = sites;
	if (!only) throw new SiteToolError("This workspace has no website yet (or it is still being generated). Say so; the merchant can create one from the dashboard.", 404);
	if (sites.length > 1) {
		const list = sites.slice(0, 10).map((site) => `${site.name?.trim() || "Untitled"} (siteId ${site.id})`).join(", ");
		throw new SiteToolError(`This workspace has ${sites.length} websites: ${list}. Ask the merchant which one, then pass that siteId.`, 409);
	}
	return String(only.id);
}

/** The tool body with `siteId` filled in when it asked for the workspace's website. Other tools and real ids pass through. */
export async function withDefaultSite(actor: AgentActor, tool: string, body: unknown): Promise<unknown> {
	if (!tool.startsWith("site.") || !body || typeof body !== "object" || Array.isArray(body)) return body;
	const record = body as Record<string, unknown>;
	if (!isAuto(record.siteId)) return body;
	return { ...record, siteId: await defaultSiteId(actor) };
}
