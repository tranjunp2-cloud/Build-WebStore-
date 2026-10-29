import { Module } from "@nestjs/common";
import { DecisionService } from "../decide/decision.service";
import { ImagesModule } from "../images/images.module";
import { LedgerModule } from "../ledger/ledger.module";
import { HttpShopTools, SHOP_TOOLS } from "../shop/shop-tools";
import { AgentController } from "./agent.controller";
import { AgentRunService } from "./agent-run.service";
import { AGENT_STORE } from "./agent-store";
import { AgentThreadService } from "./agent-thread.service";
import { AgentWorkService } from "./agent-work.service";
import { AttachmentService } from "./attachment.service";
import { QuestionFlowService } from "./ask/question-flow";
import { ChangeSetDecisionService } from "./change-set-decision.service";
import { InternalCronController } from "./cron.controller";
import { DrizzleAgentStore } from "./drizzle-agent-store";
import { StaleRunSweeper } from "./stale-run-sweeper";
import { ThreadRetentionService } from "./thread-retention.service";

@Module({
	imports: [LedgerModule, ImagesModule],
	controllers: [AgentController, InternalCronController],
	providers: [
		AgentRunService,
		ChangeSetDecisionService,
		AgentThreadService,
		AgentWorkService,
		ThreadRetentionService,
		StaleRunSweeper,
		DecisionService,
		QuestionFlowService,
		AttachmentService,
		{ provide: SHOP_TOOLS, useClass: HttpShopTools },
		{ provide: AGENT_STORE, useClass: DrizzleAgentStore },
	],
})
export class AgentModule {}
