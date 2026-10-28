import "server-only";

import { jwtVerify } from "jose";
import { getPayload } from "payload";
import config from "@payload-config";
import { resolveTenantOrganization, toPlatformUserId, verifyTenantMembership } from "@/lib/auth/bridge-token";
import type { PlatformUser } from "@/types/user";
import { getAiPlatformContextSecret } from "../config";
import { AI_CONTEXT_TOKEN_AUDIENCE, AI_CONTEXT_TOKEN_ISSUER, AgentAccessError, type AgentActor } from "../context";

/**
 * Who a facade call acts for. ai-platform forwards the context token this
 * BFF signed for the merchant's request; the user is re-loaded and their
 * membership re-checked here, so a revoked member loses access mid-run.
 */
export async function resolveToolActor(req: Request): Promise<AgentActor> {
	const header = req.headers.get("authorization") ?? "";
	const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
	const secret = getAiPlatformContextSecret();
	if (!token || !secret) throw new AgentAccessError("Missing context token.", 401);
	let claims: { sub?: string; org?: unknown; tenant?: unknown; email?: unknown; locale?: unknown };
	try {
		({ payload: claims } = await jwtVerify(token, new TextEncoder().encode(secret), {
			issuer: AI_CONTEXT_TOKEN_ISSUER,
			audience: AI_CONTEXT_TOKEN_AUDIENCE,
			algorithms: ["HS256"],
			maxTokenAge: "10m",
		}));
	} catch {
		throw new AgentAccessError("Invalid context token.", 401);
	}
	const email = typeof claims.email === "string" ? claims.email : "";
	const tenant = typeof claims.tenant === "string" ? claims.tenant : "";
	if (!claims.sub || !email || !tenant) throw new AgentAccessError("Context token is missing claims.", 401);

	const payload = await getPayload({ config });
	const found = await payload.find({
		collection: "users",
		where: { email: { equals: email } },
		limit: 1,
		overrideAccess: true,
	});
	const user = found.docs[0] as unknown as PlatformUser | undefined;
	if (!user || toPlatformUserId(user.id) !== claims.sub) throw new AgentAccessError("Unknown user.", 401);

	const verification = verifyTenantMembership(user, tenant);
	if (!verification.allowed || !verification.membership || !verification.tenantId) {
		throw new AgentAccessError("You are not an active member of this workspace.", 403);
	}
	const organization = resolveTenantOrganization(verification.membership);
	if (!organization || organization.id !== claims.org) throw new AgentAccessError("Workspace mismatch.", 403);
	return {
		user,
		tenantId: verification.tenantId,
		organizationId: organization.id,
		role: verification.membership.role ?? "member",
		locale: typeof claims.locale === "string" ? claims.locale : undefined,
	};
}
