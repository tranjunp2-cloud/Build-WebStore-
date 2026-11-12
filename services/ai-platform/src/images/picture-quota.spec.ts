import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import type { Database } from "../database/database.module";
import { MIGRATIONS } from "../database/migrations";
import { DrizzlePictureQuota } from "./picture-quota";

// TC-AISEC-053 — the picture count and the reservation are one step under a per-org lock.

const ctx: AiRequestContext = { organizationId: "org_1", userId: "usr_1", tenantId: "7", email: "o@shop.my" };
const dialect = new PgDialect();

function fakeDb(used: number) {
	const statements: { sql: string; params: unknown[] }[] = [];
	const execute = async (query: SQL) => {
		statements.push(dialect.sqlToQuery(query));
		return { rows: [{ used }] };
	};
	const db = { transaction: async (work: (tx: unknown) => Promise<void>) => work({ execute }), execute };
	return { quota: new DrizzlePictureQuota(db as unknown as Database), statements };
}

const input = { pictures: 2, since: new Date("2026-10-21T00:00:00Z"), now: new Date("2026-10-22T00:00:00Z") };

describe("DrizzlePictureQuota [TC-AISEC-053]", () => {
	it("TC-AISEC-053: takes the org lock, prunes, counts, then reserves", async () => {
		// Arrange
		const { quota, statements } = fakeDb(5);
		let seen = -1;

		// Act
		const id = await quota.reserve(ctx, input, (used) => {
			seen = used;
		});

		// Assert
		expect(seen).toBe(5);
		expect(statements.map((s) => s.sql.split(/\s+/)[0])).toEqual(["SELECT", "DELETE", "SELECT", "INSERT"]);
		expect(statements[0]).toMatchObject({ sql: "SELECT pg_advisory_xact_lock(hashtext($1))", params: ["ai_images:org_1"] });
		expect(statements[2]?.sql).toContain("GREATEST");
		expect(statements[3]?.params).toEqual([id, "org_1", "usr_1", 2, input.now]);
	});

	it("TC-AISEC-053: a refusal reserves nothing", async () => {
		// Arrange
		const { quota, statements } = fakeDb(20);

		// Act
		const reserving = quota.reserve(ctx, input, () => {
			throw new Error("limit");
		});

		// Assert
		await expect(reserving).rejects.toThrow("limit");
		expect(statements.some((s) => s.sql.startsWith("INSERT"))).toBe(false);
	});

	it("TC-AISEC-053: ships the reservation table as an idempotent migration", () => {
		const migration = MIGRATIONS.find((m) => m.name === "011_ai_image_reservations");
		const statements = (migration?.sql ?? "").split(";").map((s) => s.trim()).filter(Boolean);
		expect(statements).toHaveLength(2);
		for (const statement of statements) expect(statement).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS/);
	});
});
