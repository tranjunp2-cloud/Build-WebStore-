import { Controller, Get, Inject } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL } from "./database/database.module";

@Controller()
export class HealthController {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	@Get("health")
	async health() {
		await this.pool.query("SELECT 1");
		return { status: "ok", service: "ai-platform" };
	}
}
