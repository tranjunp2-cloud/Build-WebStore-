import { Module } from "@nestjs/common";
import { AgentModule } from "./agent/agent.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { ImagesModule } from "./images/images.module";
import { ModelsModule } from "./models/models.module";
import { SettingsModule } from "./settings/settings.module";
import { TasksModule } from "./tasks/tasks.module";

@Module({
	imports: [ConfigModule, DatabaseModule, SettingsModule, ModelsModule, ImagesModule, AgentModule, TasksModule],
	controllers: [HealthController],
})
export class AppModule {}
