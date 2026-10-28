import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";
import { summonMascot } from "./summon";

// TC-AICP-76 — an inventory proposal reads like the wireframe: action, lines with
// before → after and the signed quantity, the effect, a why, the rule, the logged note;
// Save / Send, Open to edit (only with a prefill), Dismiss.
// TC-AICP-77 — summoning the mascot never strands a request: with no dock (or reduced
// motion) the request is picked up and delivered at once.

const proposal = (capability: string, prefill = true): ChangeSet => ({
	id: "cs_1",
	runId: "run_1",
	domain: "inventory",
	title: "x",
	summary: "x",
	risk: "low",
	blastRadius: { kind: "inventory", count: 1, label: "1 line" },
	diffs: [{ entity: { kind: "inventory_item", id: "i" }, field: "on hand", before: "205", after: "201", provenance: "inferred" }],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-20T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	drafts: [
		{
			type: "inventory",
			capability,
			action: "Transfer · PrimeCommerce → Kho Hà Nội",
			lines: [{ name: "Bình Giữ Nhiệt · Đen 500ml", detail: "PrimeCommerce 140 → 120 · Kho Hà Nội 2 → 22", quantity: "× 20" }],
			effect: "PrimeCommerce keeps 120",
			why: "Kho Hà Nội còn 2, đang có 5 đơn chờ giữ hàng.",
			rule: "Posts to stock as soon as you confirm.",
			...(prefill ? { prefill: { kind: "transfer" as const, lines: [{ productId: "p", inventoryItemId: "i", quantity: 20 }] } } : {}),
		},
	],
	action: { kind: "inventory.apply", payload: {} },
});

describe("inventory proposal card [TC-AICP-76]", () => {
	it("shows lines, effect, why and the rule; a transfer sends", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={proposal("transfer.send")} onApprove={() => undefined} onEditInSheet={() => undefined} onDismiss={() => undefined} />);
		expect(html).toContain("Transfer · PrimeCommerce → Kho Hà Nội");
		expect(html).toContain("PrimeCommerce 140 → 120 · Kho Hà Nội 2 → 22");
		expect(html).toContain("× 20");
		expect(html).toContain("PrimeCommerce keeps 120");
		expect(html).toContain("Kho Hà Nội còn 2");
		expect(html).toContain("logged in stock history");
		expect(html).toMatch(/>Send<[\s\S]*>Open to edit<[\s\S]*>Dismiss</);
		expect(html).not.toContain("Open in editor");
	});

	it("saves other actions; no Open to edit without a prefill", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={proposal("warehouse.reactivate", false)} onApprove={() => undefined} onEditInSheet={() => undefined} onDismiss={() => undefined} />);
		expect(html).toContain(">Save<");
		expect(html).not.toContain("Open to edit");
	});
});

describe("summonMascot [TC-AICP-77]", () => {
	it("picks up and delivers at once when there is no dock to fly", async () => {
		const order: string[] = [];
		await summonMascot({ x: 10, y: 10, width: 200, height: 36 }, { onPickup: () => order.push("pickup"), onReturn: () => order.push("return") });
		expect(order).toEqual(["pickup", "return"]);
	});
});
