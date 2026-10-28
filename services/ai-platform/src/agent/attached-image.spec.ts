import { describe, expect, it } from "vitest";
import type { AttachmentRecord } from "./agent-store";
import { attachedImage } from "./agent-run.service";

function record(ref: string | null, origin: AttachmentRecord["origin"] = "media"): AttachmentRecord {
	return {
		id: "att_1",
		organizationId: "org_1",
		userId: "user_1",
		threadId: null,
		kind: "image",
		origin,
		ref,
		name: "shop-front.jpg",
		mime: "image/jpeg",
		size: 1000,
		textContent: null,
		credit: null,
		createdAt: new Date(0),
	};
}

describe("[TC-AIREL-64] attachedImage keeps a library pick's ref", () => {
	it("TC-AIREL-64: a media: or asset: pick is placed by its ref; anything else as the attachment", () => {
		// Arrange / Act
		const media = attachedImage(record("media:42"));
		const asset = attachedImage(record("asset:9f"));
		const stock = attachedImage(record("pixabay:7", "stock"));
		const upload = attachedImage(record(null, "upload"));

		// Assert
		expect(media.ref).toBe("media:42");
		expect(asset.ref).toBe("asset:9f");
		expect(stock.ref).toBe("attachment:att_1");
		expect(upload.ref).toBe("attachment:att_1");
	});
});
