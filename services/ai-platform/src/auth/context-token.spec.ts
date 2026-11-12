import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
	CONTEXT_TOKEN_AUDIENCE,
	CONTEXT_TOKEN_ISSUER,
	ContextTokenError,
	USAGE_SYNC_TOKEN_AUDIENCE,
	USAGE_SYNC_TOKEN_SUBJECT,
	verifyContextToken,
	verifyUsageSyncToken,
} from "./context-token";

const secret = "test-context-secret-at-least-32-characters";

async function sign(claims: Record<string, unknown>, options: { aud?: string; exp?: string; key?: string } = {}) {
	return new SignJWT(claims)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(CONTEXT_TOKEN_ISSUER)
		.setAudience(options.aud ?? CONTEXT_TOKEN_AUDIENCE)
		.setSubject("usr_1")
		.setIssuedAt()
		.setExpirationTime(options.exp ?? "5m")
		.sign(new TextEncoder().encode(options.key ?? secret));
}

describe("verifyContextToken", () => {
	it("maps claims to the request context", async () => {
		const token = await sign({ org: "org_1", tenant: "42", email: "owner@shop.my", locale: "ms" });
		await expect(verifyContextToken(token, secret)).resolves.toEqual({
			organizationId: "org_1",
			tenantId: "42",
			userId: "usr_1",
			email: "owner@shop.my",
			role: undefined,
			locale: "ms",
		});
	});

	it("rejects tokens for another audience, signed with another key, or without an org", async () => {
		await expect(verifyContextToken(await sign({ org: "o" }, { aud: "ech-platform-api" }), secret)).rejects.toThrow(
			ContextTokenError,
		);
		await expect(
			verifyContextToken(await sign({ org: "o" }, { key: "another-secret-that-is-32-characters-long" }), secret),
		).rejects.toThrow(ContextTokenError);
		await expect(verifyContextToken(await sign({}), secret)).rejects.toThrow(ContextTokenError);
	});

	it("[TC-AIREL-38] carries the BFF's capability claim into the context, and none when absent", async () => {
		const narrowed = await verifyContextToken(await sign({ org: "org_1", caps: ["site", "blog"] }), secret);
		const plain = await verifyContextToken(await sign({ org: "org_1" }), secret);

		expect(narrowed.capabilities).toEqual(["site", "blog"]);
		expect(plain).not.toHaveProperty("capabilities");
		await expect(verifyContextToken(await sign({ org: "org_1", caps: "site" }), secret)).rejects.toThrow(ContextTokenError);
	});

	it("TC-AISEC-070: carries the BFF's display name (role too), cleaned and cut to 80 characters; a bad one is dropped", async () => {
		// Arrange
		const named = await sign({ org: "org_1", role: "viewer", name: "  Chong\u0007  Wei  " });
		const long = await sign({ org: "org_1", name: "N".repeat(120) });
		const wrongType = await sign({ org: "org_1", name: 42 });

		// Act
		const [a, b, c] = await Promise.all([named, long, wrongType].map((token) => verifyContextToken(token, secret)));

		// Assert
		expect(a).toMatchObject({ name: "Chong Wei", role: "viewer" });
		expect(b?.name).toHaveLength(80);
		expect(c).not.toHaveProperty("name");
		expect(await verifyContextToken(await sign({ org: "org_1" }), secret)).not.toHaveProperty("name");
	});
});

describe("shop limits claim `lim` [TC-AIPRC-09]", () => {
	const lim = { plan: "pro", aiBudgetUsd: 5, picturesPerDay: 50 };

	it("maps a valid claim to ctx.limits (null = unlimited) and omits it when absent", async () => {
		expect((await verifyContextToken(await sign({ org: "o", lim }), secret)).limits).toEqual(lim);
		const unlimited = { plan: "max", aiBudgetUsd: null, picturesPerDay: null };
		expect((await verifyContextToken(await sign({ org: "o", lim: unlimited }), secret)).limits).toEqual(unlimited);
		expect(await verifyContextToken(await sign({ org: "o" }), secret)).not.toHaveProperty("limits");
	});

	it.each([
		["negative budget", { ...lim, aiBudgetUsd: -1 }],
		["fractional pictures", { ...lim, picturesPerDay: 1.5 }],
		["negative pictures", { ...lim, picturesPerDay: -3 }],
		["plan over 40 characters", { ...lim, plan: "p".repeat(41) }],
		["empty plan", { ...lim, plan: "" }],
		["missing field", { plan: "pro", aiBudgetUsd: 1 }],
		["string budget", { ...lim, aiBudgetUsd: "5" }],
	])("refuses the token on %s", async (_name, bad) => {
		await expect(verifyContextToken(await sign({ org: "o", lim: bad }), secret)).rejects.toThrow(ContextTokenError);
	});
});

describe("verifyUsageSyncToken", () => {
	const signSync = (options: { aud?: string; sub?: string; iat?: number; key?: string } = {}) =>
		new SignJWT({})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuer(CONTEXT_TOKEN_ISSUER)
			.setAudience(options.aud ?? USAGE_SYNC_TOKEN_AUDIENCE)
			.setSubject(options.sub ?? USAGE_SYNC_TOKEN_SUBJECT)
			.setIssuedAt(options.iat)
			.setExpirationTime("1h")
			.sign(new TextEncoder().encode(options.key ?? secret));

	it("accepts a fresh token with the sync audience and subject", async () => {
		await expect(verifyUsageSyncToken(await signSync(), secret)).resolves.toBeUndefined();
	});

	it("refuses another audience (a context token), another subject, another key and a token older than 5 minutes", async () => {
		const old = Math.floor(Date.now() / 1000) - 6 * 60;
		for (const token of [
			await signSync({ aud: CONTEXT_TOKEN_AUDIENCE }),
			await signSync({ sub: "usr_1" }),
			await signSync({ key: "another-secret-that-is-at-least-32-chars" }),
			await signSync({ iat: old }),
		]) {
			await expect(verifyUsageSyncToken(token, secret)).rejects.toBeInstanceOf(ContextTokenError);
		}
		await expect(verifyUsageSyncToken("not-a-jwt", secret)).rejects.toBeInstanceOf(ContextTokenError);
	});

	it("is not accepted as a context token", async () => {
		await expect(verifyContextToken(await signSync(), secret)).rejects.toBeInstanceOf(ContextTokenError);
	});
});
