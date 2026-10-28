import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { TasksController } from "./tasks.controller";
import { TaskEngine } from "./task-engine.service";

@Module({
	imports: [LedgerModule],
	controllers: [TasksController],
	providers: [TaskEngine],
	exports: [TaskEngine],
})
export class TasksModule {}
