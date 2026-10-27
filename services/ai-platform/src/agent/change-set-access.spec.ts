import type { AgentRun, ChangeSet } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentController } from "./agent.controller";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { AgentWorkService } from "./agent-work.service";
import { ACCESS_TEXT, callerView, forCaller } from "./change-set-access";
import { ChangeSetDecisionService } from "./change-set-decision.service";

/**
 * TC-AISEC-071..076 — AI drafts between teammates of one workspace (audit H-S2):
 *   1. chats stay private (unchanged, covered by the thread specs);
 *   2. a teammate's drafts are seen only by owners / admins, labelled with who asked;
 *   3. approve / reject / undo: the person who asked, or an owner / admin; a viewer never decides.
 */

const env = parseEnv({
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
});
const member = (userId: string, role: string | undefined, name?: string): AiRequestContext => ({
	organizationId: "org_1",
	userId,
	email: `${userId}@shop.my`,
	...(role ? { role } : {}),
	...(name ? { name } : {}),
});
const owner = member("usr_owner", "owner", "Aisyah Rahman");
const admin = member("usr_admin", "admin");
const editor = member("usr_editor", "editor", "Ben Tan");
const otherEditor = member("usr_editor2", "editor");
const viewer = member("usr_viewer", "viewer", "Chong Wei");
const custom = member("usr_custom", "custom");
const noRole = member("usr_norole", undefined);

function run(id: string): AgentRun {
	return { id, role: "merchant", domain: "cms", prompt: "do it", status: "awaiting_approval", steps: [], receipts: [], changeSetIds: [], startedAt: new Date().toISOString() };
}

function draft(id: string, runId: string, extra: Partial<ChangeSet> = {}): ChangeSet {
	return {
		id,
		runId,
		domain: "cms",
		title: `Draft ${id}`,
		summary: "",
		risk: "low",
		blastRadius: { kind: "blog_post", count: 1, label: "1 post" },
		diffs: [{ entity: { kind: "blog_post", id: "9" }, field: "title", before: "a", after: "b", provenance: "generated" }],
		guardrails: [],
		status: "pending",
		stagedBy: "agent",
		stagedAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		...extra,
	} as ChangeSet;
}

const undoable = (): Partial<ChangeSet> => ({
	status: "applied",
	result: { entities: [], links: [], undo: { kind: "blog.restore", payload: {}, until: new Date(Date.now() + 86_400_000).toISOString() } },
});

/** One draft per teammate, each in that teammate's own run (requestedBy stamped as staging does). */
async function workspace(extra: (who: AiRequestContext) => Partial<ChangeSet> = () => ({})) {
	const store = new InMemoryAgentStore();
	for (const who of [owner, editor, otherEditor, viewer, custom]) {
		await store.createRun(who, run(`run_${who.userId}`));
		await store.insertChangeSet("org_1", draft(`cs_${who.userId}`, `run_${who.userId}`, { requestedBy: { id: who.userId, name: who.name ?? null }, ...extra(who) }));
	}
	const decisions = new ChangeSetDecisionService(store);
	const controller = new AgentController({} as never, decisions, store, {} as never, {} as never, env, {} as never, { nudge: async () => 0 } as never);
	return { store, decisions, controller };
}

const ids = (list: ChangeSet[]) => list.map((cs) => cs.id).sort();

describe("rule 2: who sees a draft [TC-AISEC-071]", () => {
	it("TC-AISEC-071: owners and admins list every teammate's draft, labelled with who asked", async () => {
		// Arrange
		const { controller } = await workspace();

		// Act
		const forOwner = await controller.listChangeSets(owner, "pending");
		const forAdmin = await controller.listChangeSets(admin, "pending");

		// Assert
		expect(ids(forOwner)).toEqual(["cs_usr_custom", "cs_usr_editor", "cs_usr_editor2", "cs_usr_owner", "cs_usr_viewer"]);
		expect(ids(forAdmin)).toEqual(ids(forOwner));
		const viewersDraft = forOwner.find((cs) => cs.id === "cs_usr_viewer");
		expect(viewersDraft).toMatchObject({ requestedBy: { id: "usr_viewer", name: "Chong Wei" }, mine: false, access: { canDecide: true } });
		expect(forOwner.find((cs) => cs.id === "cs_usr_owner")).toMatchObject({ mine: true, access: { canDecide: true } });
	});

	it("TC-AISEC-071: editors, viewers, custom roles and a token without a role list only their own drafts", async () => {
		// Arrange
		const { controller } = await workspace();

		// Act + Assert
		for (const who of [editor, viewer, custom]) {
			const listed = await controller.listChangeSets(who);
			expect(ids(listed)).toEqual([`cs_${who.userId}`]);
			expect(listed[0]?.mine).toBe(true);
		}
		expect(await controller.listChangeSets(noRole)).toEqual([]);
	});

	it("TC-AISEC-072: a teammate's draft reads as not found for everyone but owners and admins", async () => {
		// Arrange
		const { controller } = await workspace();

		// Act + Assert
		for (const who of [otherEditor, viewer, custom, noRole]) {
			await expect(controller.getChangeSet(who, "cs_usr_editor")).rejects.toMatchObject({ status: 404 });
			await expect(controller.changeSetAttachment(who, "cs_usr_editor", "att_1", {} as never)).rejects.toMatchObject({ status: 404 });
		}
		await expect(controller.getChangeSet(editor, "cs_usr_editor")).resolves.toMatchObject({ mine: true, access: { canDecide: true } });
		await expect(controller.getChangeSet(owner, "cs_usr_editor")).resolves.toMatchObject({ mine: false, requestedBy: { name: "Ben Tan" } });
		await expect(controller.getChangeSet(admin, "cs_usr_editor")).resolves.toMatchObject({ mine: false, access: { canDecide: true } });
	});
});

describe("rule 3: who approves, rejects and undoes [TC-AISEC-073..074]", () => {
	it("TC-AISEC-073: the person who asked approves their own draft (claim, then approve)", async () => {
		// Arrange
		const { controller } = await workspace();

		// Act
		await controller.claim(editor, "cs_usr_editor");
		const decided = await controller.decide(editor, "cs_usr_editor", { decision: "approve", result: { entities: [], links: [] } });

		// Assert
		expect(decided).toMatchObject({ status: "applied", mine: true, decidedBy: "usr_editor@shop.my" });
	});

	it("TC-AISEC-073: owners and admins approve or reject a teammate's draft, a viewer's included", async () => {
		// Arrange
		const { controller } = await workspace();

		// Act
		await controller.claim(owner, "cs_usr_viewer");
		const approved = await controller.decide(owner, "cs_usr_viewer", { decision: "approve", result: { entities: [], links: [] } });
		const rejected = await controller.decide(admin, "cs_usr_editor", { decision: "reject" });

		// Assert
		expect(approved).toMatchObject({ status: "applied", mine: false, requestedBy: { id: "usr_viewer" } });
		expect(rejected).toMatchObject({ status: "rejected", mine: false });
	});

	it("TC-AISEC-073: an editor cannot claim, release or decide a teammate's draft (not found, nothing changes)", async () => {
		// Arrange
		const { controller, store } = await workspace();

		// Act + Assert
		await expect(controller.claim(otherEditor, "cs_usr_editor")).rejects.toMatchObject({ status: 404 });
		await expect(controller.release(otherEditor, "cs_usr_editor")).rejects.toMatchObject({ status: 404 });
		await expect(controller.decide(otherEditor, "cs_usr_editor", { decision: "reject" })).rejects.toMatchObject({ status: 404 });
		expect(store.changeSets.get("cs_usr_editor")).toMatchObject({ claimedAt: null, changeSet: { status: "pending" } });
	});

	it("TC-AISEC-073: a viewer never decides, not even their own draft: 403 with the plain sentence", async () => {
		// Arrange
		const { controller, store } = await workspace();

		// Act + Assert
		for (const call of [
			() => controller.claim(viewer, "cs_usr_viewer"),
			() => controller.release(viewer, "cs_usr_viewer"),
			() => controller.decide(viewer, "cs_usr_viewer", { decision: "reject" }),
		]) {
			await expect(call()).rejects.toMatchObject({ status: 403, response: { detail: "An owner or admin needs to approve this." } });
		}
		expect(store.changeSets.get("cs_usr_viewer")).toMatchObject({ claimedAt: null, changeSet: { status: "pending" } });
		await expect(controller.getChangeSet(viewer, "cs_usr_viewer")).resolves.toMatchObject({
			mine: true,
			access: { canDecide: false, reason: "needs_owner_or_admin" },
		});
	});

	it("TC-AISEC-073: a custom role or a token without a role decides only its own drafts", async () => {
		// Arrange
		const { controller } = await workspace();

		// Act + Assert
		await expect(controller.claim(custom, "cs_usr_custom")).resolves.toMatchObject({ mine: true, access: { canDecide: true } });
		await expect(controller.claim(custom, "cs_usr_owner")).rejects.toMatchObject({ status: 404 });
	});

	it("TC-AISEC-074: undo (revert) and redo (reinstate): who asked or an owner / admin; never a viewer or another editor", async () => {
		// Arrange
		const { controller } = await workspace(undoable);

		// Act
		const undoneByAsker = await controller.revert(editor, "cs_usr_editor", { keepUndo: true });
		const redoneByAsker = await controller.reinstate(editor, "cs_usr_editor");
		const undoneByAdmin = await controller.revert(admin, "cs_usr_viewer", {});

		// Assert
		expect(undoneByAsker).toMatchObject({ status: "reverted", mine: true });
		expect(redoneByAsker).toMatchObject({ status: "applied", mine: true });
		expect(undoneByAdmin).toMatchObject({ status: "reverted", mine: false, result: { revertedBy: "usr_admin@shop.my" } });
		await expect(controller.revert(otherEditor, "cs_usr_editor", {})).rejects.toMatchObject({ status: 404 });
		await expect(controller.revert(viewer, "cs_usr_viewer", {})).rejects.toMatchObject({ status: 403 });
		await expect(controller.reinstate(viewer, "cs_usr_viewer")).rejects.toMatchObject({ status: 403 });
	});
});

describe("who asked, and what the caller may do [TC-AISEC-075]", () => {
	it("TC-AISEC-075: a draft staged before `requestedBy` takes its asker from the run (name unknown)", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		await store.createRun(editor, run("run_old"));
		await store.insertChangeSet("org_1", draft("cs_old", "run_old"));
		const controller = new AgentController({} as never, new ChangeSetDecisionService(store), store, {} as never, {} as never, env, {} as never, {} as never);

		// Act
		const seenByOwner = await controller.getChangeSet(owner, "cs_old");
		const seenByAsker = await controller.getChangeSet(editor, "cs_old");

		// Assert
		expect(seenByOwner).toMatchObject({ requestedBy: { id: "usr_editor", name: null }, mine: false, access: { canDecide: true } });
		expect(seenByAsker).toMatchObject({ mine: true, access: { canDecide: true } });
	});

	it("TC-AISEC-075: `access` and `mine` are per caller and never stored, whatever the client sends back", async () => {
		// Arrange
		const { store, decisions } = await workspace();
		const current = forCaller(owner, (await store.getChangeSet("org_1", "cs_usr_editor"))?.changeSet as ChangeSet);

		// Act
		await store.updateChangeSet("org_1", { ...current, access: { canDecide: true }, mine: true });
		const seenByViewerOfOwn = await decisions.get(viewer, "cs_usr_viewer");

		// Assert
		expect(store.changeSets.get("cs_usr_editor")?.changeSet).not.toHaveProperty("access");
		expect(store.changeSets.get("cs_usr_editor")?.changeSet).not.toHaveProperty("mine");
		expect(seenByViewerOfOwn).not.toHaveProperty("access");
	});

	it("TC-AISEC-075: the caller view follows the three rules for every role", () => {
		// Arrange
		const cases: [AiRequestContext, string, { mine: boolean; visible: boolean; canDecide: boolean }][] = [
			[owner, "usr_editor", { mine: false, visible: true, canDecide: true }],
			[admin, "usr_viewer", { mine: false, visible: true, canDecide: true }],
			[editor, "usr_editor", { mine: true, visible: true, canDecide: true }],
			[editor, "usr_owner", { mine: false, visible: false, canDecide: false }],
			[viewer, "usr_viewer", { mine: true, visible: true, canDecide: false }],
			[viewer, "usr_owner", { mine: false, visible: false, canDecide: false }],
		];

		// Act + Assert
		for (const [who, asker, expected] of cases) {
			const view = callerView(who, asker);
			expect({ mine: view.mine, visible: view.visible, canDecide: view.access.canDecide }).toEqual(expected);
		}
		expect(callerView(owner, null)).toMatchObject({ mine: false, visible: true });
		expect(callerView(editor, null)).toMatchObject({ mine: false, visible: false });
		expect(ACCESS_TEXT.needs_owner_or_admin).toBe("An owner or admin needs to approve this.");
	});
});

const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** A copilot whose model drafts one product, then answers — in every run, whatever other calls the service makes. */
function copilot() {
	const draftCall = { name: "propose_product_drafts", input: { locale: "en-US", products: [{ name: "Batik Silk Scarf", description: "Scarf." }] } };
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			// a tool result came back (or a call without tools, e.g. suggestions): answer; otherwise draft
			const drafts = (options.tools?.length ?? 0) > 0 && options.prompt.at(-1)?.role !== "tool";
			const content = drafts
				? [{ type: "tool-call" as const, toolCallId: `call_${Math.random().toString(36).slice(2)}`, toolName: draftCall.name, input: JSON.stringify(draftCall.input) }]
				: [{ type: "text" as const, text: "Drafted." }];
			return { content, finishReason: { unified: drafts ? ("tool-calls" as const) : ("stop" as const), raw: undefined }, usage, warnings: [] };
		},
	});
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "deepseek", modelId: "deepseek-chat" }] };
	const threads = new AgentThreadService(store, env);
	const runs = new AgentRunService(store, models, ledger, env, threads);
	const work = new AgentWorkService(store, threads);
	const decisions = new ChangeSetDecisionService(store);
	const controller = new AgentController(runs, decisions, store, threads, {} as never, env, work, { nudge: async () => 0 } as never);
	return { store, runs, work, controller };
}

/** A Fastify reply whose SSE frames are collected. */
function sseReply() {
	const frames: { type: string; changeSet?: ChangeSet }[] = [];
	const raw = {
		writableEnded: false,
		writableFinished: false,
		writeHead: () => undefined,
		once: () => undefined,
		write: (chunk: string) => {
			if (chunk.startsWith("data: ")) frames.push(JSON.parse(chunk.slice(6)));
			return true;
		},
		end() {
			this.writableEnded = true;
		},
	};
	return { frames, reply: { hijack: () => undefined, raw } };
}

describe("drafts staged by a run [TC-AISEC-076]", () => {
	it("TC-AISEC-076: staging stamps who asked from the signed context, and the streamed card carries the asker's access", async () => {
		// Arrange
		const { store, controller } = copilot();
		const { frames, reply } = sseReply();

		// Act
		await controller.startRun(viewer, { prompt: "please create a product for me" }, { headers: { accept: "text/event-stream" } } as never, reply as never);

		// Assert
		const staged = frames.find((frame) => frame.type === "changeset.staged")?.changeSet;
		expect(staged).toMatchObject({ requestedBy: { id: "usr_viewer", name: "Chong Wei" }, mine: true, access: { canDecide: false, reason: "needs_owner_or_admin" } });
		const stored = store.changeSets.get(staged?.id as string)?.changeSet;
		expect(stored?.requestedBy).toEqual({ id: "usr_viewer", name: "Chong Wei" });
		expect(stored).not.toHaveProperty("access");
	});

	it("TC-AISEC-076: a viewer's waiting drafts are not an approve item in their own queue; an editor's are", async () => {
		// Arrange
		const { runs, work, controller } = copilot();
		await runs.start(viewer, { prompt: "please create a product for me" }, () => undefined);
		await runs.start(editor, { prompt: "please create a product for me" }, () => undefined);

		// Act
		const viewerWork = await work.work(viewer);
		const editorWork = await work.work(editor);
		const thread = await controller.getThread(viewer, (await controller.listThreads(viewer))[0]?.id as string);

		// Assert
		expect(viewerWork.reviews).toEqual([]);
		expect(editorWork.reviews).toHaveLength(1);
		expect(thread.changeSets[0]).toMatchObject({ mine: true, access: { canDecide: false, reason: "needs_owner_or_admin" } });
	});
});
