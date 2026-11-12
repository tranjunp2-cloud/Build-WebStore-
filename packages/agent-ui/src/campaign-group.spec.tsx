import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { approveCampaign, campaignCards, campaignQueue, CampaignHeader, DEFAULT_CAMPAIGN_LABELS, stoppedLine, waitingForCode } from "./campaign-group";
import { ReviewSheet } from "./review-sheet";

// TC-AICP-220..223 (+248: order by kind) — linked cards of one promo campaign: the "Campaign: 11.11" tag and Approve all
// above the first card, approval in staging order (the code before the banner), stopping at the first
// failure, typed-confirm cards left out, and Approve all in the wide review.

function card(id: string, step: number | undefined, extra: Partial<ChangeSet> = {}): ChangeSet {
	return {
		id,
		runId: "run_1",
		domain: "campaigns",
		title: `Card ${id}`,
		summary: "",
		risk: "low",
		blastRadius: { kind: "x", count: 1, label: "1" },
		diffs: [],
		guardrails: [],
		status: "pending",
		stagedBy: "agent",
		stagedAt: "2026-10-22T00:00:00Z",
		expiresAt: "2026-10-23T00:00:00Z",
		...(step === undefined ? {} : { group: { id: "cmp_1", label: "11.11", step } }),
		...extra,
	} as ChangeSet;
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const trio = [card("code", 1), card("banner", 2), card("post", 3)];

describe("campaign tag and Approve all [TC-AICP-220]", () => {
	it("puts the tag and Approve all (n) above the first card, only the tag above the others", () => {
		const first = renderToStaticMarkup(<CampaignHeader changeSet={trio[0]!} turnCards={trio} onApprove={async () => undefined} />);
		const second = renderToStaticMarkup(<CampaignHeader changeSet={trio[1]!} turnCards={trio} onApprove={async () => undefined} />);

		expect(text(first)).toBe("Campaign: 11.11 Approve all (3)");
		expect(text(second)).toBe("Campaign: 11.11");
		expect(second).not.toContain("<button");
	});

	it("renders nothing for a card that is not part of a campaign", () => {
		expect(renderToStaticMarkup(<CampaignHeader changeSet={card("solo", undefined)} turnCards={[card("solo", undefined)]} onApprove={async () => undefined} />)).toBe("");
	});

	it("counts only what Approve all will approve and says typed cards stay separate", () => {
		const cards = [card("code", 1), card("gone", 2, { confirmText: "SALE1111" }), card("done", 3, { status: "applied" }), card("post", 4)];

		const html = renderToStaticMarkup(<CampaignHeader changeSet={cards[0]!} turnCards={cards} onApprove={async () => undefined} />);

		expect(text(html)).toBe(`Campaign: 11.11 Approve all (2) ${DEFAULT_CAMPAIGN_LABELS.typedNote}`);
	});

	it("offers no Approve all when one card is left, and takes the labels of the host", () => {
		const one = [card("code", 1, { status: "applied" }), card("post", 2)];
		expect(text(renderToStaticMarkup(<CampaignHeader changeSet={one[0]!} turnCards={one} onApprove={async () => undefined} />))).toBe("Campaign: 11.11");
		const viHtml = renderToStaticMarkup(<CampaignHeader changeSet={trio[0]!} turnCards={trio} onApprove={async () => undefined} labels={{ tag: "Chiến dịch: {label}", approveAll: "Duyệt tất cả ({n})" }} />);
		expect(text(viHtml)).toBe("Chiến dịch: 11.11 Duyệt tất cả (3)");
	});
});

describe("Approve all runs in staging order [TC-AICP-221]", () => {
	it("approves one card after the other by step, the code first, even when listed out of order", async () => {
		const order: string[] = [];
		const approve = vi.fn(async (changeSet: ChangeSet) => {
			order.push(changeSet.id);
			await Promise.resolve();
			order.push(`${changeSet.id}:done`);
			return { ...changeSet, status: "applied" };
		});

		const outcome = await approveCampaign([trio[2]!, trio[0]!, trio[1]!], approve);

		expect(order).toEqual(["code", "code:done", "banner", "banner:done", "post", "post:done"]);
		expect(outcome).toEqual({ approved: 3 });
	});

	it("leaves out typed-confirm cards and cards that are no longer waiting, and reports progress", async () => {
		const cards = [card("code", 1), card("gone", 2, { confirmText: "SALE1111" }), card("done", 3, { status: "applied" }), card("post", 4)];
		const approve = vi.fn(async (_changeSet: ChangeSet) => ({ status: "applied" }));
		const steps: Array<[number, number]> = [];

		const outcome = await approveCampaign(cards, approve, (done, total) => steps.push([done, total]));

		expect((approve.mock.calls as unknown as Array<[ChangeSet]>).map(([c]) => c.id)).toEqual(["code", "post"]);
		expect(steps).toEqual([[0, 2], [1, 2]]);
		expect(outcome.approved).toBe(2);
		expect(campaignQueue(cards).map((c) => c.id)).toEqual(["code", "post"]);
	});

	it("sorts a group by step, keeps cards without a step in listed order after the numbered ones", () => {
		const cards = [card("b", undefined, { group: { id: "cmp_1", label: "x" } }), card("a", 2), card("c", 1), card("other", 1, { group: { id: "cmp_2", label: "y", step: 1 } })];

		expect(campaignCards(cards, "cmp_1").map((c) => c.id)).toEqual(["c", "a", "b"]);
	});
});

describe("Approve all order by kind [TC-AICP-248]", () => {
	const code = (id: string, step?: number) => card(id, step, { action: { kind: "store.discounts_patch", payload: {} } });
	const page = (id: string, step?: number, kind = "site.page_edit") => card(id, step, { action: { kind, payload: {} } });
	const post = (id: string, step?: number) => card(id, step, { action: { kind: "blog.create_draft", payload: {} } });

	it("approves discount codes first, then page / nav / seo / translation cards, then blog posts, whatever the staged order", async () => {
		const staged = [post("post-1", 1), page("page-2", 2), code("code-3", 3), page("nav-4", 4, "site.nav_patch"), post("post-5", 5), page("lang-6", 6, "site.languages_patch"), code("code-7", 7)];
		const approve = vi.fn(async (changeSet: ChangeSet) => ({ ...changeSet, status: "applied" }));

		await approveCampaign(staged, approve);

		expect(approve.mock.calls.map(([c]) => c.id)).toEqual(["code-3", "code-7", "page-2", "nav-4", "lang-6", "post-1", "post-5"]);
		expect(campaignCards(staged, "cmp_1").map((c) => c.id)).toEqual(["code-3", "code-7", "page-2", "nav-4", "lang-6", "post-1", "post-5"]);
	});

	it("keeps staged order inside a kind when steps tie, and a draft of type blog counts as a blog post", () => {
		const blogDraft = card("draft", 1, { drafts: [{ type: "blog", title: "t", html: "<p>x</p>", words: 1, sections: 1, images: [], seo: { title: "t", description: "d" } }] });
		const cards = [blogDraft, page("b", 1), page("a", 1), code("c", 1)];

		expect(campaignCards(cards, "cmp_1").map((c) => c.id)).toEqual(["c", "b", "a", "draft"]);
	});
});

describe("Approve all stops at the first failure [TC-AICP-222]", () => {
	it("stops when a card throws, reports which, and never tries the cards after it", async () => {
		const approve = vi.fn(async (changeSet: ChangeSet) => {
			if (changeSet.id === "banner") throw new Error("The page changed since this draft");
			return { ...changeSet, status: "applied" };
		});

		const outcome = await approveCampaign(trio, approve);

		expect(approve.mock.calls.map(([c]) => c.id)).toEqual(["code", "banner"]);
		expect(outcome.approved).toBe(1);
		expect(outcome.failed?.changeSet.id).toBe("banner");
		expect(stoppedLine(outcome)).toBe("Stopped at “Card banner”: The page changed since this draft. The rest is still waiting.");
	});

	it("stops when the host answers that the card was not applied", async () => {
		const approve = vi.fn(async (changeSet: ChangeSet) => ({ ...changeSet, status: changeSet.id === "code" ? "expired" : "applied" }));

		const outcome = await approveCampaign(trio, approve);

		expect(approve).toHaveBeenCalledTimes(1);
		expect(outcome).toMatchObject({ approved: 0, failed: { changeSet: { id: "code" }, message: "it is expired" } });
	});

	it("gives a plain message for an error without one, and says nothing when all went through", async () => {
		const outcome = await approveCampaign([card("code", 1)], async () => Promise.reject("boom"));

		expect(stoppedLine(outcome)).toContain("something went wrong");
		expect(stoppedLine({ approved: 3 })).toBeNull();
	});
});

describe("Approve all waits for the discount code [TC-AICP-274]", () => {
	const code = (id: string, extra: Partial<ChangeSet> = {}) => card(id, 1, { action: { kind: "store.discounts_patch", payload: {} }, ...extra });
	const banner = card("banner", 2, { action: { kind: "site.page_edit", payload: {} } });
	const post = card("post", 3, { action: { kind: "blog.create_draft", payload: {} } });

	it("leaves the banner and the post out when the code card was rejected, and approves nothing else", async () => {
		const cards = [code("code", { status: "rejected" }), banner, post];
		const approve = vi.fn(async (changeSet: ChangeSet) => ({ ...changeSet, status: "applied" }));

		expect(campaignQueue(cards)).toEqual([]);
		const outcome = await approveCampaign(cards, approve);

		expect(approve).not.toHaveBeenCalled();
		expect(outcome).toEqual({ approved: 0 });
		expect(waitingForCode(cards)).toBe(true);
	});

	it.each(["expired", "superseded", "reverted"] as const)("also holds them back when the code card is %s", (status) => {
		expect(campaignQueue([code("code", { status }), banner, post])).toEqual([]);
	});

	it("holds them back while the code card waits for a typed confirm, but still approves the other code cards", () => {
		const typed = code("big", { confirmText: "RAYA10" });
		const other = code("small");

		expect(campaignQueue([typed, other, banner, post]).map((c) => c.id)).toEqual(["small"]);
		expect(waitingForCode([typed, banner, post])).toBe(true);
	});

	it("approves the banner and the post once the code card is applied", async () => {
		const cards = [code("code", { status: "applied" }), banner, post];
		const approve = vi.fn(async (changeSet: ChangeSet) => ({ ...changeSet, status: "applied" }));

		await approveCampaign(cards, approve);

		expect(approve.mock.calls.map(([c]) => c.id)).toEqual(["banner", "post"]);
		expect(waitingForCode(cards)).toBe(false);
	});

	it("approves the code, then the banner, when all three wait", async () => {
		const approve = vi.fn(async (changeSet: ChangeSet) => ({ ...changeSet, status: "applied" }));

		await approveCampaign([post, banner, code("code")], approve);

		expect(approve.mock.calls.map(([c]) => c.id)).toEqual(["code", "banner", "post"]);
	});

	it("stops before the banner when the code card comes back as anything but applied", async () => {
		const approve = vi.fn(async (changeSet: ChangeSet) => ({ ...changeSet, status: "pending" }));

		const outcome = await approveCampaign([code("code"), banner, post], approve);

		expect(approve).toHaveBeenCalledTimes(1);
		expect(outcome).toMatchObject({ approved: 0, failed: { changeSet: { id: "code" }, message: "it is pending" } });
	});

	it("says in the bar why the banner waits when the code card was rejected", () => {
		const cards = [code("code", { status: "rejected" }), banner, post];

		const html = renderToStaticMarkup(<CampaignHeader changeSet={cards[0]!} turnCards={cards} onApprove={async () => undefined} />);

		expect(text(html)).toContain(DEFAULT_CAMPAIGN_LABELS.codeFirstNote);
		expect(html).not.toContain("<button");
	});

	it("sees the code card of an earlier reply: one bar, on the newest reply, counting every waiting card", () => {
		const earlier = [code("code", { status: "applied" }), card("page", 2, { action: { kind: "site.page_edit", payload: {} } })];
		const later = [post];
		const all = [...earlier, ...later];

		const barLater = renderToStaticMarkup(<CampaignHeader changeSet={post} turnCards={later} allCards={all} onApprove={async () => undefined} />);
		const tagEarlier = renderToStaticMarkup(<CampaignHeader changeSet={earlier[0]!} turnCards={earlier} allCards={all} onApprove={async () => undefined} />);

		expect(text(barLater)).toBe("Campaign: 11.11 Approve all (2)");
		expect(text(tagEarlier)).toBe("Campaign: 11.11");
		expect(tagEarlier).not.toContain("<button");
	});
});

describe("Approve all in the wide review [TC-AICP-223]", () => {
	const blog = card("post", 3, {
		domain: "cms",
		drafts: [{ type: "blog", title: "Khuyến mãi 11.11", html: "<p>Mã SALE1111</p>", words: 3, sections: 1, images: [], seo: { title: "Khuyến mãi 11.11", description: "Giảm 15% đến 15/11" } }],
	});

	it("shows Approve all next to Approve for a pending campaign draft", () => {
		const html = renderToStaticMarkup(
			<ReviewSheet changeSet={blog} onApprove={() => undefined} campaign={{ tag: "Campaign: 11.11", approveAll: "Approve all (3)", onApproveAll: async () => undefined }} />,
		);

		expect(html).toMatch(/<button[^>]*title="Campaign: 11.11"[^>]*>Approve all \(3\)<\/button>/);
		expect(html).toContain("Approve</button>");
	});

	it("has no Approve all without a campaign, for a decided draft or one that needs a typed name", () => {
		const campaign = { tag: "t", approveAll: "Approve all (2)", onApproveAll: async () => undefined };
		expect(renderToStaticMarkup(<ReviewSheet changeSet={blog} onApprove={() => undefined} />)).not.toContain("Approve all");
		expect(renderToStaticMarkup(<ReviewSheet changeSet={{ ...blog, status: "applied" }} onApprove={() => undefined} campaign={campaign} />)).not.toContain("Approve all");
		expect(renderToStaticMarkup(<ReviewSheet changeSet={{ ...blog, confirmText: "x" }} onApprove={() => undefined} campaign={campaign} />)).not.toContain("Approve all");
	});
});

// TC-AIWB-129 — several drafts of one request (group kind "set", e.g. 3 blog posts): the label alone, still Approve all.
describe("a set of drafts from one request [TC-AIWB-129]", () => {
	const set = ["a", "b", "c"].map((id, index) =>
		card(id, undefined, { action: { kind: "blog.create_draft", payload: {} }, group: { id: "set_1", label: "Rainy season tips", kind: "set", step: index + 1 } }),
	);

	it("shows the set's label without the Campaign prefix, with Approve all above the first card", () => {
		// Act
		const first = renderToStaticMarkup(<CampaignHeader changeSet={set[0]!} turnCards={set} onApprove={async () => undefined} />);
		const second = renderToStaticMarkup(<CampaignHeader changeSet={set[1]!} turnCards={set} onApprove={async () => undefined} />);

		// Assert
		expect(text(first)).toBe("Rainy season tips Approve all (3)");
		expect(text(second)).toBe("Rainy season tips");
	});

	it("approves the set's cards one after the other in their order", async () => {
		// Arrange
		const approved: string[] = [];

		// Act
		const outcome = await approveCampaign(campaignCards([set[2]!, set[0]!, set[1]!], "set_1"), async (c) => void approved.push(c.id));

		// Assert
		expect(approved).toEqual(["a", "b", "c"]);
		expect(outcome).toEqual({ approved: 3 });
	});
});
