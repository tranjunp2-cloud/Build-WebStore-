import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { AiRequestContext } from "../auth/context-token";
import { DB, type Database } from "../database/database.module";
import { aiImageReservations, aiUsageEvents } from "../database/schema";

export const IMAGE_TASK = "media.generate-image";

/** Reservations are only counted for a day; each org's older rows go on its next reserve. */
export const IMAGE_RESERVATION_KEEP_MS = 2 * 24 * 60 * 60 * 1000;

export interface PictureReserve {
	pictures: number;
	/** start of the quota window (a day back) */
	since: Date;
	now: Date;
}

/**
 * The daily picture cap, checked and reserved in one step: parallel requests
 * cannot all see the same count and pass it.
 */
export interface PictureQuota {
	/**
	 * Under a per-org lock: counts the org's pictures since `since` (reservations, and ledger rows
	 * from before reservations existed), calls `admit(used)` — which throws to refuse — then
	 * reserves `pictures`. Returns the reservation id.
	 */
	reserve(ctx: AiRequestContext, input: PictureReserve, admit: (used: number) => void): Promise<string>;
	/** Gives a reservation back: only when no provider was reached (nothing could be billed). */
	release(organizationId: string, reservationId: string): Promise<void>;
}

export const PICTURE_QUOTA = Symbol("AI_PLATFORM_PICTURE_QUOTA");

/** `ai_image_reservations` under `pg_advisory_xact_lock(hashtext('ai_images:' || org))`. */
@Injectable()
export class DrizzlePictureQuota implements PictureQuota {
	constructor(@Inject(DB) private readonly db: Database) {}

	async reserve(ctx: AiRequestContext, input: PictureReserve, admit: (used: number) => void): Promise<string> {
		const id = randomUUID();
		const org = ctx.organizationId;
		const r = aiImageReservations;
		const u = aiUsageEvents;
		await this.db.transaction(async (tx) => {
			await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ai_images:${org}`}))`);
			await tx.execute(
				sql`DELETE FROM ${r} WHERE ${r.organizationId} = ${org} AND ${r.createdAt} < ${new Date(input.now.getTime() - IMAGE_RESERVATION_KEEP_MS)}`,
			);
			// GREATEST: a success is both a reservation and ledger rows; ledger rows alone are from before reservations
			const result = await tx.execute<{ used: number }>(sql`SELECT GREATEST(
				(SELECT coalesce(sum(${r.pictures}), 0) FROM ${r} WHERE ${r.organizationId} = ${org} AND ${r.createdAt} >= ${input.since}),
				(SELECT count(*) FROM ${u} WHERE ${u.organizationId} = ${org} AND ${u.task} = ${IMAGE_TASK} AND ${u.outcome} <> 'error' AND ${u.createdAt} >= ${input.since})
			)::int AS used`);
			admit(Number(result.rows[0]?.used ?? 0));
			await tx.execute(
				sql`INSERT INTO ${r} (id, organization_id, user_id, pictures, created_at) VALUES (${id}, ${org}, ${ctx.userId}, ${input.pictures}, ${input.now})`,
			);
		});
		return id;
	}

	async release(organizationId: string, reservationId: string): Promise<void> {
		const r = aiImageReservations;
		await this.db.execute(sql`DELETE FROM ${r} WHERE ${r.id} = ${reservationId} AND ${r.organizationId} = ${organizationId}`);
	}
}

/** Tests and local doubles: no await between the count and the push, atomic like the per-org lock. */
export class InMemoryPictureQuota implements PictureQuota {
	readonly reservations: { id: string; organizationId: string; pictures: number; createdAt: Date }[] = [];

	/** `ledgerUsed`: pictures already in the ledger (rows from before reservations). */
	constructor(private readonly ledgerUsed = 0) {}

	async reserve(ctx: AiRequestContext, input: PictureReserve, admit: (used: number) => void): Promise<string> {
		const reserved = this.reservations
			.filter((row) => row.organizationId === ctx.organizationId && row.createdAt >= input.since)
			.reduce((sum, row) => sum + row.pictures, 0);
		admit(Math.max(reserved, this.ledgerUsed));
		const id = randomUUID();
		this.reservations.push({ id, organizationId: ctx.organizationId, pictures: input.pictures, createdAt: input.now });
		return id;
	}

	async release(organizationId: string, reservationId: string): Promise<void> {
		const index = this.reservations.findIndex((row) => row.id === reservationId && row.organizationId === organizationId);
		if (index >= 0) this.reservations.splice(index, 1);
	}
}
