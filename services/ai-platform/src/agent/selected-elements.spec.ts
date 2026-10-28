import { describe, expect, it } from "vitest";
import { merchantUserMessage, selectedLine } from "./merchant-tools";

// TC-AIWB-61 — Ask AI on an element: the user turn names exactly what the
// merchant picked (kind, section id, path, what it says now) so the copilot
// edits that and nothing else; not when the merchant removed the page chip.

const button = { kind: "button" as const, label: "Mua ngay", pageId: "7", blockId: "blk_hero", path: "ctaButtons.0.label", value: "Mua ngay" };
const seo = { kind: "seo" as const, label: "Home", pageId: "7", path: "seoTitle", value: "Kedai Demo — Fesyen Muslim Premium" };

describe("Selected on the page [TC-AIWB-61]", () => {
	it("names each element with the ids the ops take and its current value", () => {
		expect(selectedLine([button, seo])).toBe(
			'Selected on the page (the merchant means exactly these): button "Mua ngay" (page id "7", section "blk_hero", path "ctaButtons.0.label"), now "Mua ngay"; seo "Home" (page id "7", path "seoTitle"), now "Kedai Demo — Fesyen Muslim Premium"',
		);
		expect(selectedLine([])).toBeNull();
	});

	it("rides on the user turn after the Context line, and only while the page is pinned", () => {
		const pinned = merchantUserMessage({ module: "editor", today: "2026-10-21", elements: [button] }, "Hấp dẫn hơn");
		const lines = pinned.split("\n");
		expect(lines[0]).toMatch(/^Context: /);
		expect(lines[1]).toMatch(/^Selected on the page/);
		expect(pinned.endsWith("\n\nHấp dẫn hơn")).toBe(true);

		const unpinned = merchantUserMessage({ today: "2026-10-21", elements: [button] }, "Hấp dẫn hơn");
		expect(unpinned).not.toContain("Selected on the page");
	});

	it("keeps values short and on one line", () => {
		const long = { ...button, value: `Dòng một\nDòng hai ${"x".repeat(400)}` };
		const line = selectedLine([long]) ?? "";
		expect(line).not.toContain("\n");
		expect(line.length).toBeLessThan(420);
	});
});

// TC-AICP-136 — records picked from a reply's cards reach the model by id, apart from things on the page
describe("Picked in the chat [TC-AICP-136]", () => {
	it("names each picked record with its id, after what was selected on the page", () => {
		const picked = { kind: "product" as const, label: "Áo thun tay ngắn", recordId: "prod_1" };
		const post = { kind: "post" as const, label: "Batik care", recordId: "b1" };

		expect(selectedLine([picked, post])).toBe('Picked in the chat (the merchant means exactly these): product "Áo thun tay ngắn" (id "prod_1"); blog post "Batik care" (id "b1")');
		const both = selectedLine([{ kind: "text", label: "Hero", blockId: "blk_1" }, picked]) ?? "";
		expect(both.split("\n")).toEqual([expect.stringMatching(/^Selected on the page/), expect.stringMatching(/^Picked in the chat/)]);
	});
});
