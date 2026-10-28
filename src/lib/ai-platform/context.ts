import "server-only";

import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { resolveTenantOrganization, toPlatformUserId, verifyTenantMembership } from "@/lib/auth/bridge-token";
import type { PlatformUser } from "@/types/user";
import { getAiPlatformContextSecret } from "./config";

export const AI_CONTEXT_TOKEN_ISSUER = "prime-web";
export const AI_CONTEXT_TOKEN_AUDIENCE = "ai-platform";
const AI_CONTEXT_TOKEN_TTL = "5m";

/** The authenticated caller, scoped to the workspace they are acting in. */
export interface AgentActor {
	user: PlatformUser;
	tenantId: string;
	organizationId: string;
	role: string;
	locale?: string;
}

export class AgentAccessError extends Error {
	constructor(
		message: string,
		readonly status: 401 | 403 | 503,
	) {
		super(message);
	}
}

/**
 * Same chain as the commerce proxy: session → requested workspace (header or
 * cookie) → verified membership. A browser-supplied workspace is a request,
 * never a grant.
 */
export async function resolveAgentActor(req: Request): Promise<AgentActor> {
	// The copilot refunds, emails buyers and publishes: a password without the OTP step is not enough.
	const user = (await getCurrentUser(req, { requireMfa: true })) as PlatformUser | null;
	if (!user) throw new AgentAccessError("Sign in to use the AI assistant.", 401);
	return resolveActorForUser(user, req);
}

/**
 * Same as resolveAgentActor for routes that already authenticated the session.
 * Routes acting on a tenant-owned record (a site) pass its `tenantId`, so usage
 * and quota land on that workspace rather than whichever one the cookie names.
 */
export async function resolveActorForUser(
	user: PlatformUser,
	req: Request,
	options: { tenantId?: string | null } = {},
): Promise<AgentActor> {
	if (options.tenantId) return actorForUserInTenant(user, options.tenantId);
	const cookieStore = await cookies();
	const requested =
		req.headers.get("x-workspace-id") ||
		cookieStore.get("active-tenant-id")?.value ||
		cookieStore.get("workspaceId")?.value ||
		null;
	return actorForUserInTenant(user, requested);
}

/**
 * The user acting inside one known workspace (a site's or a record's tenant)
 * with no request in scope: collection hooks, cron workers, CLI scripts.
 * Membership is still verified — work only ever runs as an active member.
 */
export function actorForUserInTenant(user: PlatformUser, tenantId: string | null): AgentActor {
	const verification = verifyTenantMembership(user, tenantId);
	if (!verification.allowed || !verification.membership || !verification.tenantId) {
		// Platform staff act through a workspace they belong to; AI usage is always billed to one.
		const message = user.roles?.includes("super-admin")
			? "AI features run inside a workspace you are a member of. Join this workspace to use AI here."
			: "You are not an active member of this workspace.";
		throw new AgentAccessError(message, 403);
	}
	const organization = resolveTenantOrganization(verification.membership);
	if (!organization) throw new AgentAccessError("This workspace has no organization yet.", 403);
	return {
		user,
		tenantId: verification.tenantId,
		organizationId: organization.id,
		role: verification.membership.role ?? "member",
		locale: user.prefer_lang ?? undefined,
	};
}

/**
 * How teammates see who asked for an AI draft ("Asked by …"): first + last name, else the email's local part,
 * at most 80 characters. A label only — access is decided by the user id and the membership role.
 */
export function agentDisplayName(user: Pick<PlatformUser, "firstName" | "lastName" | "email">): string | undefined {
	const full = [user.firstName, user.lastName].map((part) => part?.trim()).filter(Boolean).join(" ");
	const name = (full || user.email?.split("@")[0] || "").replace(/\s+/g, " ").trim().slice(0, 80).trim();
	return name || undefined;
}

/**
 * What Prime Web's copilot may do, sent as the token's `caps` claim: ai-platform narrows its own
 * AI_AGENT_CAPABILITIES to this list. Prime Web's products are its own Payload `products`
 * (shop_products); the Product Master world (product_master, inventory, store_products) has no
 * endpoints here, so it stays off even when the platform's env would allow it.
 */
export const PRIME_WEB_AGENT_CAPABILITIES = [
	"site",
	"blog",
	"stock_photos",
	"media_library",
	"image_generation",
	"shop_products",
	"store_categories",
	"store_discounts",
	"store_orders",
	"store_customers",
	"campaigns",
	"store_reports",
] as const;

/** Short-lived HS256 token ai-platform trusts instead of any browser input. */
export async function signAgentContextToken(actor: AgentActor): Promise<string> {
	const secret = getAiPlatformContextSecret();
	if (!secret) throw new Error("AI_PLATFORM_CONTEXT_SECRET is not configured.");
	const name = agentDisplayName(actor.user);
	return new SignJWT({
		org: actor.organizationId,
		tenant: actor.tenantId,
		email: actor.user.email,
		role: actor.role,
		...(name ? { name } : {}),
		...(actor.locale ? { locale: actor.locale } : {}),
		caps: [...PRIME_WEB_AGENT_CAPABILITIES],
	})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(AI_CONTEXT_TOKEN_ISSUER)
		.setAudience(AI_CONTEXT_TOKEN_AUDIENCE)
		// Same user id the platform-api bridge token carries, so ledgers join.
		.setSubject(toPlatformUserId(actor.user.id))
		.setIssuedAt()
		.setExpirationTime(AI_CONTEXT_TOKEN_TTL)
		.sign(new TextEncoder().encode(secret));
}
