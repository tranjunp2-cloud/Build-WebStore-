import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { ImageService } from "./image.service";
import { ImagesController } from "./images.controller";
import { DrizzlePictureQuota, PICTURE_QUOTA } from "./picture-quota";

@Module({
	imports: [LedgerModule],
	controllers: [ImagesController],
	providers: [ImageService, { provide: PICTURE_QUOTA, useClass: DrizzlePictureQuota }],
	exports: [ImageService],
})
export class ImagesModule {}
