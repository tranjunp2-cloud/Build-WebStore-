import { describe, expect, it } from "vitest";
import { testEnv } from "../testing/test-app";
import { attachmentBodyLimit, attachmentMaxBytes, dbPoolMax, formatLimit, pgPoolConfig } from "./limits";

describe("serverless limits", () => {
	it("[TC-AIREL-13] keeps 16 MiB bodies and 10 MB files locally, and fits Vercel's 4.5 MB cap there", () => {
		// Arrange
		const local = testEnv();
		const vercel = testEnv({ VERCEL: "1" });

		// Act + Assert
		expect(attachmentBodyLimit(local)).toBe(16 * 1024 * 1024);
		expect(attachmentMaxBytes(local)).toBe(10 * 1024 * 1024);
		expect(attachmentBodyLimit(vercel)).toBeLessThan(4.5 * 1024 * 1024);
		expect(attachmentMaxBytes(vercel)).toBe(3_000_000);
		// 3 MB of file is ~4 MB of base64: the file limit must fit inside the body limit
		expect(Math.ceil((attachmentMaxBytes(vercel) * 4) / 3)).toBeLessThan(attachmentBodyLimit(vercel));
	});

	it("[TC-AIREL-13] lets env override both limits, but never lifts a file past the contract's 10 MB", () => {
		// Arrange
		const env = testEnv({ VERCEL: "1", AI_ATTACHMENT_BODY_LIMIT_BYTES: "2000000", AI_ATTACHMENT_MAX_BYTES: "1000000" });
		const tooBig = testEnv({ AI_ATTACHMENT_MAX_BYTES: String(50 * 1024 * 1024) });

		// Act + Assert
		expect(attachmentBodyLimit(env)).toBe(2_000_000);
		expect(attachmentMaxBytes(env)).toBe(1_000_000);
		expect(attachmentMaxBytes(tooBig)).toBe(10 * 1024 * 1024);
		expect(formatLimit(3_000_000)).toBe("3 MB");
		expect(formatLimit(10 * 1024 * 1024)).toBe("10 MB");
	});

	it("[TC-AIREL-15] sizes the pg pool 5 locally, 3 on Vercel, and honours AI_PLATFORM_DB_POOL_MAX", () => {
		// Arrange + Act + Assert
		expect(dbPoolMax(testEnv())).toBe(5);
		expect(dbPoolMax(testEnv({ VERCEL: "1" }))).toBe(3);
		expect(dbPoolMax(testEnv({ VERCEL: "1", AI_PLATFORM_DB_POOL_MAX: "8" }))).toBe(8);
		expect(() => testEnv({ AI_PLATFORM_DB_POOL_MAX: "0" })).toThrow(/AI_PLATFORM_DB_POOL_MAX/);
	});

	it("[TC-AISEC-012] bounds every wait for a pg connection (5 s) and closes idle ones after 10 s", () => {
		// Arrange + Act
		const config = pgPoolConfig(testEnv({ VERCEL: "1" }));

		// Assert: a busy 3-connection pool fails fast instead of queuing until the function dies
		expect(config).toEqual({ connectionString: "postgres://x/y", max: 3, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000 });
		expect(config).not.toHaveProperty("statement_timeout");
	});
});
