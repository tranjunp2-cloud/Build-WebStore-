import { jwtVerify } from "jose";
import { z } from "zod";

export const CONTEXT_TOKEN_ISSUER = "prime-web";
export const CONTEXT_TOKEN_AUDIENCE = "ai-platform";

/**
 * Who is asking, as asserted by the BFF that authenticated the session.
 * ai-platform never trusts org/user ids sent by a browser — only this token.
 */
export const AiRequestContextSchema = z.object({
	organizationId: z.string().min(1),
	tenantId: z.string().min(1).optional(),
	userId: z.string().min(1),
	email: z.string().optional(),
	/** membership role in the workspace (owner, admin, editor, viewer, custom…) */
	role: z.string().optional(),
	/** display name for teammates ("Asked by …"): first + last name or the email's local part, ≤80 chars */
	name: z.string().optional(),
	locale: z.string().optional(),
	/**
	 * Copilot capabilities this request may use (names as in AI_AGENT_CAPABILITIES), set by the
	 * BFF. It can only narrow what the server allows; absent = the server's set.
	 */
	capabilities: z.array(z.string()).optional(),
});
export type AiRequestContext = z.infer<typeof AiRequestContextSchema> & {
	/**
	 * The verified token itself — forwarded to prime-web's agent tool facade so
	 * shop reads run with the same user's access. Never logged, never stored.
	 */
	token?: string;
};

const ClaimsSchema = z.object({
	sub: z.string().min(1),
	org: z.string().min(1),
	tenant: z.string().min(1).optional(),
	email: z.string().optional(),
	role: z.string().optional(),
	locale: z.string().optional(),
	// a display name only: an unusable one is dropped, never a reason to refuse the token
	name: z.string().optional().catch(undefined),
	caps: z.array(z.string().max(40)).max(32).optional(),
});

export class ContextTokenError extends Error {}

/** Trimmed, control characters dropped, at most 80 characters; undefined when nothing is left. */
export function displayName(value: string | undefined): string | undefined {
	const clean = value?.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80).trim();
	return clean ? clean : undefined;
}

export async function verifyContextToken(token: string, secret: string): Promise<AiRequestContext> {
	let payload: unknown;
	try {
		({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
			issuer: CONTEXT_TOKEN_ISSUER,
			audience: CONTEXT_TOKEN_AUDIENCE,
			algorithms: ["HS256"],
			maxTokenAge: "10m",
		}));
	} catch (error) {
		throw new ContextTokenError(error instanceof Error ? error.message : "invalid context token");
	}
	const claims = ClaimsSchema.safeParse(payload);
	if (!claims.success) throw new ContextTokenError("context token is missing required claims");
	return {
		organizationId: claims.data.org,
		tenantId: claims.data.tenant,
		userId: claims.data.sub,
		email: claims.data.email,
		role: claims.data.role,
		...(displayName(claims.data.name) ? { name: displayName(claims.data.name) } : {}),
		locale: claims.data.locale,
		...(claims.data.caps ? { capabilities: claims.data.caps } : {}),
	};
}
