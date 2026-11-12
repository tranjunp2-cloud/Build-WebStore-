import { describe, expect, it } from "vitest";
import { merchantInstructions } from "./merchant-instructions";

// TC-AICHAT-014 — issue #2217: the app draws "waits / applied / undone" from the card under the reply, so the
// instructions never ask the model to say it (with Auto-approve on it would be wrong a moment later).

describe("the model does not state approval status [TC-AICHAT-014]", () => {
	it("TC-AICHAT-014: no instruction asks the reply to say a change waits for approval", () => {
		// Act
		const prompt = merchantInstructions();

		// Assert
		expect(prompt).not.toMatch(/waits for their (approval|confirmation)|never say it is done/);
		expect(prompt).toContain("Never say whether it waits for approval, is applied, is now, is done or can be undone");
	});
});
