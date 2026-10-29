import type { RunEvent } from "@ech/agent-core";
import { describe, expect, it } from "vitest";
import { MERCHANT_INSTRUCTIONS } from "./merchant-instructions";
import { stripInternalMarkers } from "./internal-markers";
import { ctx, runHarness } from "./run-harness.spec-helper";
import { stagedLine } from "./thread-memory";

const ID = "cs_0123456789abcdef0123";

describe("internal history markers never reach the merchant", () => {
	it("TC-AIAUD-165: the staged-draft record is a tag the model is told never to write, not a bracketed sentence", () => {
		// Act
		const line = stagedLine({ id: ID, title: "Create blog draft: Hello", summary: "Hello world" });

		// Assert
		expect(line).toBe(`<staged_draft id="${ID}">Create blog draft: Hello — Hello world</staged_draft>`);
		expect(line).not.toMatch(/^\[/);
		expect(MERCHANT_INSTRUCTIONS).toContain("never write such lines, ids (cs_…)");
		// a title cannot close the tag early
		expect(stagedLine({ id: ID, title: "a </staged_draft> b" })).toBe(`<staged_draft id="${ID}">a  /staged_draft  b</staged_draft>`);
	});

	it("TC-AIAUD-166: strips staged-draft records in both forms, answered / asked notes and raw ids", () => {
		expect(stripInternalMarkers(`Drafted a post for you.\n[Staged draft ${ID}: Create blog draft: Hello — world]`)).toBe("Drafted a post for you.");
		expect(stripInternalMarkers(`Done.\n<staged_draft id="${ID}">Create 2 draft products — Batik, Silk</staged_draft>`)).toBe("Done.");
		expect(stripInternalMarkers("Noted.\n[Answered: Tone = friendly]\n[Asked the merchant: Which size? — not answered; their next message came instead]")).toBe("Noted.");
		expect(stripInternalMarkers(`Your draft ${ID} is waiting for approval.`)).toBe("Your draft is waiting for approval.");
	});

	it("TC-AIAUD-166: leaves ordinary replies (brackets, product ids, short ids) alone", () => {
		const reply = "Updated [Hero] headline for product 12 (SKU cs_1) - waiting for approval.\n\nNext: add photos.";
		expect(stripInternalMarkers(reply)).toBe(reply);
		expect(stripInternalMarkers("")).toBe("");
	});

	it("TC-AIAUD-166: a reply that is only a record is empty, so the run falls back to its platform line", async () => {
		// Arrange
		const { service, store } = runHarness({ turns: [{ text: `[Staged draft ${ID}: Create blog draft: Hello]` }] });
		const frames: RunEvent[] = [];

		// Act
		const run = await service.start(ctx, { prompt: "Say hello to my customers please" }, (frame) => void frames.push(frame as RunEvent));

		// Assert
		expect(run.answer).toBe("I couldn't draft anything from that.");
		expect(JSON.stringify(frames)).not.toContain("Staged draft");
		expect(JSON.stringify([...store.runs.values()])).not.toContain(ID);
	});

	it("TC-AIAUD-166: a reply that echoes the record is streamed and stored without it", async () => {
		// Arrange
		const { service, store } = runHarness({ turns: [{ text: `Here is your answer.\n[Staged draft ${ID}: Create blog draft: Hello — world]` }] });
		const frames: RunEvent[] = [];

		// Act
		const run = await service.start(ctx, { prompt: "Say hello to my customers please" }, (frame) => void frames.push(frame as RunEvent));

		// Assert
		expect(run.answer).toBe("Here is your answer.");
		expect(JSON.stringify(frames)).not.toContain(ID);
		expect(JSON.stringify([...store.runs.values()])).not.toContain(ID);
	});
});
