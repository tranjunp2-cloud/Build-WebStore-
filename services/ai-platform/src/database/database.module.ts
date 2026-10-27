import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { pgPoolConfig } from "../config/limits";
import * as schema from "./schema";

export const PG_POOL = Symbol("AI_PLATFORM_PG_POOL");
export const DB = Symbol("AI_PLATFORM_DB");
export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
	providers: [
		{
			provide: PG_POOL,
			inject: [ENV],
			useFactory: (env: Env) => new Pool(pgPoolConfig(env)),
		},
		{
			provide: DB,
			inject: [PG_POOL],
			useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
		},
	],
	exports: [PG_POOL, DB],
})
export class DatabaseModule implements OnApplicationShutdown {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async onApplicationShutdown(): Promise<void> {
		await this.pool.end();
	}
}
