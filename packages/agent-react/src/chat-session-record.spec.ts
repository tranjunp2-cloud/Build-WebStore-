import type { AgentEvent, AgentRun, AgentThread, StartRunInput } from "@ech/agent-core";
import type { AgentGateway } from "@ech/agent-transport";
import { describe, expect, it, vi } from "vitest";
import { outsideWebBuilderChats } from "./chat-runtime";
import { ChatSession } from "./chat-session";
import { memoryThreadHint } from "./chat-turns";

// TC-AICP-126 — every prompt says where the merchant is (page title + address), also with
// the page chip removed; a chat started on a record (product, post) is offered on its page.

const thread = (id: string, patch: Partial<AgentThread> = {}): AgentThread => ({
	id,
	title: `Chat ${id}`,
	runCount: 1,
	createdAt: "2026-10-21T00:00:00Z",
	updatedAt: "2026-10-21T00:00:00Z",
	...patch,
});

function gateway(threads: AgentThread[]) {
	const started: StartRunInput[] = [];
	const g = {
		listThreads: vi.fn(async (limit = 20, filter?: { entity?: { kind: string; id: string } }) => {
			const entity = filter?.entity;
			return threads.filter((t) => !entity || (t.entity?.kind === entity.kind && t.entity.id === entity.id)).slice(0, limit);
		}),
		getThread: vi.fn(async (id: string) => {
			const found = threads.find((t) => t.id === id);
			return found ? { thread: found, runs: [], changeSets: [] } : null;
		}),
		startRun: vi.fn(async (input: StartRunInput): Promise<AgentRun> => {
			started.push(input);
			return {
				id: "run_1",
				role: "merchant",
				domain: "products",
				prompt: input.prompt,
				status: "planning",
				steps: [],
				receipts: [],
				changeSetIds: [],
				threadId: input.threadId ?? "thr_new",
				startedAt: "2026-10-21T00:00:00Z",
			};
		}),
		subscribe: (_listener: (event: AgentEvent) => void) => () => undefined,
	};
	return { gateway: g as unknown as AgentGateway, started, listThreads: g.listThreads };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("where the merchant is rides on every prompt [TC-AICP-126]", () => {
	it("sends the page title and address with the pin, and without it once the chip is removed", async () => {
		const { gateway: g, started } = gateway([]);
		const session = new ChatSession(g, { hint: memoryThreadHint(""), restoreLatest: false });
		const page = { title: "eCommerce Operations › Product Master", path: "/catalog/products", module: "products" };
		session.page = page;
		session.context = { module: "products" };
		await session.send("which page am I on");
		session.context = undefined;
		await session.send("and now?");
		expect(started[0]).toMatchObject({ context: { module: "products" }, page });
		expect(started[1]?.context).toBeUndefined();
		expect(started[1]?.page).toEqual(page);
	});
});

describe("the chat started on a record is offered on its page [TC-AICP-126]", () => {
	const onShirt = thread("thr_shirt", { entity: { kind: "product", id: "prod_1", label: "Grey Shirt" } });
	const editorChat = thread("thr_site", { domain: "webbuilder", entity: { kind: "product", id: "prod_1" } });

	it("finds the newest chat about the record (in this surface's scope) and opens it", async () => {
		const { gateway: g, listThreads } = gateway([editorChat, onShirt, thread("thr_other")]);
		const session = new ChatSession(g, { hint: memoryThreadHint(""), restoreLatest: false, scope: outsideWebBuilderChats });
		await session.linkTo({ kind: "product", id: "prod_1" });
		expect(listThreads).toHaveBeenCalledWith(3, { entity: { kind: "product", id: "prod_1" } });
		expect(session.getSnapshot().linked?.id).toBe("thr_shirt");
		await session.openLinked();
		expect(session.getSnapshot().threadId).toBe("thr_shirt");
	});

	it("offers nothing on a record without a chat, and forgets the offer on another page", async () => {
		const { gateway: g } = gateway([onShirt]);
		const session = new ChatSession(g, { hint: memoryThreadHint(""), restoreLatest: false });
		await session.linkTo({ kind: "product", id: "prod_2" });
		expect(session.getSnapshot().linked).toBeUndefined();
		await session.linkTo({ kind: "product", id: "prod_1" });
		expect(session.getSnapshot().linked?.id).toBe("thr_shirt");
		await session.linkTo(undefined);
		expect(session.getSnapshot().linked).toBeUndefined();
	});

	it("an answer for the record the merchant already left is dropped", async () => {
		const { gateway: g } = gateway([onShirt]);
		const session = new ChatSession(g, { hint: memoryThreadHint(""), restoreLatest: false });
		const first = session.linkTo({ kind: "product", id: "prod_1" });
		void session.linkTo(undefined);
		await first;
		await settle();
		expect(session.getSnapshot().linked).toBeUndefined();
	});
});

// TC-AICP-129 — "Use this" chooses a picture of the chat: it waits in the tray (with its
// thumbnail) until sent, again = not chosen; the message carries the ids and shows the pictures.
describe("pictures chosen with Use this [TC-AICP-129]", () => {
	const coffee = { url: "https://cdn.pixabay.com/7.jpg", alt: "coffee, grinds", label: "Pixabay · a", imageId: "img_35", ref: "pixabay:7" };
	const cup = { url: "https://cdn.pixabay.com/8.jpg", label: "Pixabay · b", imageId: "img_36", ref: "pixabay:8" };

	it("toggles a picture in the tray, sends the ids in order and shows them on the message", async () => {
		const { gateway: g, started } = gateway([]);
		const session = new ChatSession(g, { hint: memoryThreadHint(""), restoreLatest: false });
		session.choosePicture(coffee);
		session.choosePicture(cup);
		session.choosePicture(cup);
		session.choosePicture(cup);
		expect(session.getSnapshot().attachments.map((a) => [a.key, a.previewUrl, a.status])).toEqual([
			["chosen:img_35", coffee.url, "ready"],
			["chosen:img_36", cup.url, "ready"],
		]);
		expect(session.canSend("")).toBe(true);

		await session.send("Dùng 2 ảnh này làm gallery");
		expect(started[0]).toMatchObject({ prompt: "Dùng 2 ảnh này làm gallery", pictureIds: ["img_35", "img_36"] });
		expect(started[0]?.attachmentIds).toBeUndefined();
		const user = session.getSnapshot().turns.find((t) => t.role === "user");
		expect(user?.role === "user" ? user.pictures?.map((p) => p.imageId) : null).toEqual(["img_35", "img_36"]);
		expect(session.getSnapshot().attachments).toEqual([]);
	});

	it("sends a default prompt with only a chosen picture, and drops the choice when another chat opens", async () => {
		const { gateway: g, started } = gateway([thread("thr_other")]);
		const session = new ChatSession(g, { hint: memoryThreadHint(""), restoreLatest: false });
		session.choosePicture(coffee);
		await session.send("");
		expect(started[0]).toMatchObject({ prompt: "Use the chosen picture.", pictureIds: ["img_35"] });

		session.choosePicture(cup);
		await session.openThread("thr_other");
		expect(session.getSnapshot().attachments).toEqual([]);
	});
});
