import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { CONTEXT_TOKEN_AUDIENCE, CONTEXT_TOKEN_ISSUER, ContextTokenError, verifyContextToken } from "./context-token";

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
