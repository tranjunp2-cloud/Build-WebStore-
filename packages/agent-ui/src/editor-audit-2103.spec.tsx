// @vitest-environment jsdom
import type { AgentRun, ChangeSet, ContextElement, WorkItem } from "@ech/agent-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentAssistantPanel, pendingEditHref } from "./assistant-panel";
import type { AgentChatView } from "./chat";
import { ChatComposer } from "./composer";
import { DEFAULT_DRAFT_LABELS } from "./draft-card";
import { FLY_MS, flyToComposer } from "./fly";
import { formattingOnly, SiteChangeRows } from "./site-change-rows";

// TC-AIAUD-070..079 — the chat in the editor and the dashboard, audit #2103: a text edit that only changed its
// formatting says so, the chip a thing on the page becomes lands on its real place (and the flying copy never
// stays), the Tab hint does not cover the chips row, the mascot raises nothing on a form screen.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const siteCard = (before: string | null, after: string): ChangeSet => ({
	id: "cs_fmt",
	runId: "run_1",
	domain: "webbuilder",
	title: "Edit page: Home",
	summary: "Make the headline bold",
	risk: "low",
	blastRadius: { kind: "site_block", count: 1, label: "1 section on 1 page" },
	diffs: [{ entity: { kind: "site_block", id: "blk_hero", label: "Hero · Home" }, field: "headline", before, after, provenance: "generated" }],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-29T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind: "site.page_patch", payload: { siteId: "1", pageId: "7", ops: [], expect: {} } },
});

describe("a text edit that only changed formatting [TC-AIAUD-070]", () => {
	const rows = (changeSet: ChangeSet) =>
		renderToStaticMarkup(<SiteChangeRows changeSet={changeSet} labels={DEFAULT_DRAFT_LABELS} fieldName={(field) => field} notes={[]} expanded onExpandedChange={() => undefined} />);

	it("TC-AIAUD-070: the line says Formatting changed and does not strike through the same words", () => {
		// Arrange: the server shows text without markup, so before and after read the same
		const changeSet = siteCard("Welcome to Kedai Batik", "Welcome to Kedai Batik");

		// Act
		const html = rows(changeSet);

		// Assert
		expect(html).toContain("Formatting changed");
		expect(html).not.toContain("<s ");
		expect(html).not.toContain(">Welcome to Kedai Batik<");
	});

	it("TC-AIAUD-070: a real text change still shows the new words and the old ones struck through", () => {
		const html = rows(siteCard("Welcome", "Welcome to Kedai Batik"));

		expect(html).toContain("Welcome to Kedai Batik");
		expect(html).toMatch(/<s[^>]*>Welcome<\/s>/);
		expect(html).not.toContain("Formatting changed");
	});

	it("TC-AIAUD-070: formattingOnly is true for identical words, false for a real change or a cut text", () => {
		const diff = (before: string | null, after: string) => siteCard(before, after).diffs[0]!;
		expect(formattingOnly(diff("Hello", "Hello"))).toBe(true);
		expect(formattingOnly(diff("Hello", "Hello there"))).toBe(false);
		expect(formattingOnly(diff(null, "Hello"))).toBe(false);
		expect(formattingOnly(diff(`${"x".repeat(599)}…`, `${"x".repeat(599)}…`))).toBe(false);
	});
});

describe("the composer's Tab hint [TC-AIAUD-071]", () => {
	it("TC-AIAUD-071: sits in the typing box (not the footer row), under the chips row", () => {
		// Arrange + Act
		const html = renderToStaticMarkup(
			<ChatComposer
				attachments={[]}
				onFiles={() => undefined}
				onRemove={() => undefined}
				onPick={() => undefined}
				listMedia={async () => []}
				canSend={() => true}
				onSend={() => undefined}
				hint="Which products have no photos?"
				elements={{ items: [{ kind: "button", label: "Shop now" }], onRemove: () => undefined }}
			/>,
		);

		// Assert: chips row first, then the box holding the textarea and the hint
		const chips = html.indexOf("data-agent-elements");
		const box = html.indexOf('class="ech-ag-cmp-box"');
		const hint = html.indexOf("ech-ag-tab-hint");
		const footer = html.indexOf('class="ech-ag-c-row"');
		expect(chips).toBeGreaterThan(-1);
		expect(box).toBeGreaterThan(chips);
		expect(hint).toBeGreaterThan(box);
		expect(hint).toBeLessThan(footer);
	});
});

describe("an element flying into the message box [TC-AIAUD-072]", () => {
	const element: ContextElement = { kind: "button", label: "Shop now" };
	const from = { x: 20, y: 20, width: 80, height: 30 };
	let composer: HTMLFormElement;
	let animate: ReturnType<typeof vi.fn>;
	let finish: () => void;

	beforeEach(() => {
		vi.useFakeTimers();
		composer = document.createElement("form");
		composer.className = "ech-ag-cmp";
		document.body.appendChild(composer);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
			const landed = this.classList.contains("ech-ag-el") && !this.classList.contains("is-flying");
			return (landed ? { left: 40, top: 300, width: 90, height: 26, right: 130, bottom: 326, x: 40, y: 300, toJSON: () => ({}) } : { left: 10, top: 280, width: 300, height: 120, right: 310, bottom: 400, x: 10, y: 280, toJSON: () => ({}) }) as DOMRect;
		});
		animate = vi.fn(() => {
			const flight: { onfinish: null | (() => void); oncancel: null | (() => void) } = { onfinish: null, oncancel: null };
			finish = () => flight.onfinish?.();
			return flight;
		});
		(HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		composer.remove();
		for (const node of document.querySelectorAll(".is-flying")) node.remove();
		delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
	});

	/** What the host does: put the real chip in the box. */
	const attach = () => {
		const row = document.createElement("div");
		row.setAttribute("data-agent-elements", "");
		const chip = document.createElement("span");
		chip.className = "ech-ag-el";
		row.appendChild(chip);
		composer.appendChild(row);
	};

	it("TC-AIAUD-072: the real chip is attached first, hidden while the copy flies, and shown when it lands", async () => {
		// Arrange
		const order: string[] = [];
		const done = flyToComposer(from, { element, kindLabel: "Button" }, document, {
			attach: () => {
				order.push("attach");
				attach();
			},
		});
		animate.mockImplementationOnce(() => {
			order.push("fly");
			return { onfinish: null, oncancel: null } as never;
		});

		// Act
		await vi.advanceTimersByTimeAsync(20);
		const chip = composer.querySelector<HTMLElement>(".ech-ag-el");
		const hiddenWhileFlying = chip?.style.visibility;
		const [frames] = animate.mock.calls[0] ?? [];
		const landing = (frames as Array<{ transform: string }>).at(-1)?.transform;
		await vi.advanceTimersByTimeAsync(FLY_MS + 150);
		await done;

		// Assert: attach before the flight, hidden meanwhile, the copy lands on the chip's place, then revealed and removed
		expect(order).toEqual(["attach", "fly"]);
		expect(hiddenWhileFlying).toBe("hidden");
		expect(landing).toBe("translate(40px, 300px) scale(1)");
		expect(chip?.style.visibility).toBe("");
		expect(document.querySelector(".is-flying")).toBeNull();
	});

	it("TC-AIAUD-073: a copy whose animation never ends is removed after FLY_MS + 150 ms", async () => {
		// Arrange
		const done = flyToComposer(from, { element, kindLabel: "Button" }, document, { attach });
		await vi.advanceTimersByTimeAsync(20);
		expect(document.querySelector(".is-flying")).not.toBeNull();

		// Act: the animation never reports an end
		await vi.advanceTimersByTimeAsync(FLY_MS + 150);
		await done;

		// Assert
		expect(document.querySelector(".is-flying")).toBeNull();
		expect(composer.querySelector<HTMLElement>(".ech-ag-el")?.style.visibility).toBe("");
	});

	it("TC-AIAUD-073: finishing early settles once (the safety timer does not run twice)", async () => {
		// Arrange
		const done = flyToComposer(from, { element, kindLabel: "Button" }, document, { attach });
		await vi.advanceTimersByTimeAsync(20);

		// Act
		finish();
		await done;
		await vi.advanceTimersByTimeAsync(FLY_MS + 500);

		// Assert
		expect(document.querySelector(".is-flying")).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("TC-AIAUD-072: with nothing to fly to (no message box on screen) the chip is still attached, once", async () => {
		// Arrange
		composer.remove();
		const attachOnce = vi.fn();

		// Act
		await flyToComposer(from, { element, kindLabel: "Button" }, document, { attach: attachOnce });

		// Assert
		expect(attachOnce).toHaveBeenCalledTimes(1);
		expect(animate).not.toHaveBeenCalled();
	});

	it("TC-AIAUD-072: when the real chip never appears the copy lands in the box's corner and still ends", async () => {
		// Arrange
		const done = flyToComposer(from, { element, kindLabel: "Button" }, document, { attach: () => undefined });

		// Act
		await vi.advanceTimersByTimeAsync(200);
		const [frames] = animate.mock.calls[0] ?? [];
		await vi.advanceTimersByTimeAsync(FLY_MS + 150);
		await done;

		// Assert
		expect((frames as Array<{ transform: string }>).at(-1)?.transform).toBe("translate(22px, 290px) scale(1)");
		expect(document.querySelector(".is-flying")).toBeNull();
	});
});

describe("the mascot on a form screen [TC-AIAUD-074]", () => {
	const run: AgentRun = { id: "run_1", role: "merchant", domain: "products", prompt: "x", status: "applied", steps: [], receipts: [], changeSetIds: [], startedAt: "2026-10-29T00:00:00Z" };
	const view: AgentChatView = {
		turns: [{ id: "run_1", role: "assistant", run, changeSets: [] }],
		busy: false,
		send: async () => undefined,
		canSend: () => true,
		retry: async () => undefined,
		answer: async () => undefined,
		searchOptions: async () => [],
		attachments: [],
		attachmentError: undefined,
		attachFiles: async () => undefined,
		attachPicked: async () => undefined,
		uploadPictures: async () => [],
		removeAttachment: () => undefined,
		listMedia: async () => [],
	};
	const item: WorkItem = {
		key: "orders",
		source: "shop",
		kind: "orders",
		group: "now",
		order: 0,
		count: 2,
		title: "2 orders wait",
		detail: "Orders",
		area: "Orders",
		icon: "receipt",
		say: "Two orders are waiting for you. Want to look at them now?",
		short: "2 orders waiting.",
		actions: [{ label: "Check", kind: "prompt", value: "Which orders are waiting?" }],
		taskKey: "shop:orders",
		taskTitle: "Orders",
		fingerprint: "orders#2",
	};
	let host: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		vi.useFakeTimers();
		// local noon: outside the quiet hours that hold back unprompted raises
		vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
		vi.stubGlobal("CSS", { supports: () => true });
		window.localStorage.clear();
		host = document.createElement("div");
		document.body.appendChild(host);
		root = createRoot(host);
	});
	afterEach(() => {
		act(() => root.unmount());
		host.remove();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	const mount = async (quiet: boolean) => {
		await act(async () => {
			root.render(<AgentAssistantPanel chat={view} pending={[]} work={{ items: [item], states: [], quiet, onLater: () => undefined }} />);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(4000);
		});
	};

	it("TC-AIAUD-074: raises the next issue over the mascot by itself on a normal screen", async () => {
		await mount(false);
		expect(host.querySelector(".ech-ag-raise")).not.toBeNull();
	});

	it("TC-AIAUD-074: raises nothing on a form screen (the badge stays)", async () => {
		await mount(true);
		expect(host.querySelector(".ech-ag-raise")).toBeNull();
		expect(host.querySelector(".ech-ag-fab")).not.toBeNull();
	});
});

describe("opening a pending edit [TC-AIAUD-082]", () => {
	it("TC-AIAUD-082: a shop product edit has no page to open (it is decided in the chat); a Product Master edit still opens its product", () => {
		const base = siteCard(null, "x");
		const shop = { ...base, action: { kind: "shop_product.update", payload: {} }, drafts: [{ type: "product_edit" }], diffs: [{ ...base.diffs[0]!, entity: { kind: "product", id: "12" } }] } as unknown as ChangeSet;
		const master = { ...shop, action: { kind: "product_master.update", payload: {} } } as unknown as ChangeSet;

		expect(pendingEditHref(shop)).toBeUndefined();
		expect(pendingEditHref(master)).toBe("/catalog/products/12");
	});
});
