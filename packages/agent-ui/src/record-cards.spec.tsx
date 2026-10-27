import { type AgentRun, contextElementKey } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chosenRecords, RecordCards, recordElement, runRecords } from "./record-cards";

// TC-AICP-133 — a product or post the reply read or found is one small card (picture, name,
// kind · status · price, Open), not a grid of its photos; none when the reply staged a change.
const run = (receipts: AgentRun["receipts"], changeSetIds: string[] = []): AgentRun => ({
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: "Check Kemeja-T",
	status: "applied",
	steps: [],
	receipts,
	changeSetIds,
	startedAt: "2026-10-22T00:00:00Z",
});
const receipt = (records: NonNullable<AgentRun["receipts"][number]["records"]>) => ({ id: "r", tool: "content.read", summary: "Read", durationMs: 1, status: "ok" as const, entityIds: [], records });

describe("record cards [TC-AICP-133]", () => {
	it("lists each record once, the read completing what a search listed", () => {
		const records = runRecords(
			run([
				receipt([{ kind: "product", id: "p1", title: "Kemeja-T", status: "draft" }]),
				receipt([{ kind: "product", id: "p1", title: "Kemeja-T Gaya Pejabat", thumb: "https://cdn.example/p1.jpg", href: "/catalog/products/p1" }]),
			]),
		);

		expect(records).toEqual([{ kind: "product", id: "p1", title: "Kemeja-T Gaya Pejabat", status: "draft", thumb: "https://cdn.example/p1.jpg", href: "/catalog/products/p1" }]);
	});

	it("shows none when the reply staged a change (its draft card shows the record)", () => {
		expect(runRecords(run([receipt([{ kind: "post", id: "b1", title: "Batik care" }])], ["cs_1"]))).toEqual([]);
	});

	it("renders a card that opens in the app, and never a link or picture from elsewhere", () => {
		const html = renderToStaticMarkup(
			<RecordCards
				records={[
					{ kind: "product", id: "p1", title: "Kemeja-T", status: "draft", meta: "Price: RM 59", href: "/catalog/products/p1", thumb: "https://cdn.example/p1.jpg" },
					{ kind: "post", id: "b1", title: "Batik care", href: "https://evil.example", thumb: "javascript:alert(1)" },
				]}
			/>,
		);

		expect(html).toContain('href="/catalog/products/p1"');
		expect(html).toContain("Product · draft · Price: RM 59");
		expect(html).not.toContain("evil.example");
		expect(html).not.toContain("javascript:");
		expect(html).toContain("Blog post");
	});
});

// TC-AICP-136 — found records can be picked: "Use" puts a record in the message box as a chip
// (kind product / post with its id), pressed again it comes back out; three cards show, the rest
// behind "Show N more".
describe("picking records [TC-AICP-136]", () => {
	const records = Array.from({ length: 5 }, (_, i) => ({ kind: "product" as const, id: `p${i}`, title: `Product ${i}` }));

	it("shows three cards and Show 2 more, each with Use (Selected when picked)", () => {
		const html = renderToStaticMarkup(<RecordCards records={records} chosen={new Set(["product:p1"])} onUse={() => undefined} />);

		expect(html.match(/class="ech-ag-record"/g)).toHaveLength(3);
		expect(html).toContain("Show 2 more");
		expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
		expect(html).toMatch(/aria-pressed="true"[^>]*>.*Selected/);
	});

	it("a picked record is a chip with the record id, keyed like the message box keys it", () => {
		const element = recordElement({ kind: "post", id: "b1", title: "Batik care" });

		expect(element).toEqual({ kind: "post", label: "Batik care", recordId: "b1" });
		expect(contextElementKey(element)).toBe("post:b1");
		expect(chosenRecords([element, { kind: "text", label: "Hero" }])).toEqual(new Set(["post:b1"]));
	});
});
