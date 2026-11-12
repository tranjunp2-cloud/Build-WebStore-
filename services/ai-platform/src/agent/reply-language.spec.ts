import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { capabilitySet } from "./merchant-capabilities";
import { merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, MERCHANT_INSTRUCTIONS, type MerchantToolDeps, type PagePatchToolInput, merchantUserMessage } from "./merchant-tools";
import { replyLanguageName, replyLanguageNote, wrongReplyLanguage } from "./message-language";
import { REPLY_LANGUAGE_TASK, replyInLanguageOf } from "./reply-language";
import { ctx, runHarness } from "./run-harness.spec-helper";
import { groupsInUserTurn } from "./tool-routing";
import { looksDeclined } from "./suggest-next";

// TC-AIAUD-190..198 — #2103 round 3 (run_1c6ac07abf564fc59fcf): after a Malay turn, the English question "Make the
// Hero display as two columns on desktop and one column on mobile…" got a Malay reply that also claimed the picture
// stays above the heading on mobile "if the variant supports it". The reply language is now pinned at the end of
// the turn and checked on the final reply; a section style is a name, never a layout promise.

// the exact values of the live run
const MALAY_TURN = "Tukar tajuk bahagian utama kepada 'Penjagaan Kulit Untuk Setiap Hari'. Jangan ubah harga produk atau halaman lain.";
const ENGLISH_ASK = "Make the Hero display as two columns on desktop and one column on mobile. Keep the product image above the heading on mobile.";
const LIVE_MALAY_REPLY =
	"Saya telah mencadangkan susun atur Hero dua lajur pada desktop dan satu lajur pada mudah alih untuk kelulusan anda. Susun atur ini mengekalkan imej di atas tajuk pada paparan mudah alih jika varian tersebut menyokong turutan itu; saya tidak mengubah bahagian lain.";
const ENGLISH_DECLINE = "I can't set columns or the order of picture and heading for phones from the chat, so I haven't changed anything.";

const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const answering = (value: string) =>
	new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: "text" as const, text: value }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] }) });

describe("clear English is told apart with fewer words [TC-AIAUD-190]", () => {
	it("TC-AIAUD-190: the live prompt and short clear English requests name English", () => {
		expect(replyLanguageName(ENGLISH_ASK)).toBe("English");
		expect(replyLanguageName("Make hero shorter")).toBe("English");
		expect(replyLanguageName("Update the title")).toBe("English");
	});

	it("TC-AIAUD-190: other Latin-script languages, Malay and short text are not called English", () => {
		expect(replyLanguageName("Añade un banner de rebajas a mi página principal")).toBeNull();
		expect(replyLanguageName("Ajoute une section avec une image")).toBeNull();
		expect(replyLanguageName("ok thanks")).toBeNull();
		// English loanwords in a Malay message do not make it English
		expect(replyLanguageName("Tolong update hero section sekarang juga")).toBeNull();
		expect(replyLanguageName("Tolong tambah banner jualan untuk laman utama saya")).toBe("Malay");
	});
});

describe("the reply language closes the user turn [TC-AIAUD-191]", () => {
	const context = { module: "editor", today: "2026-10-29" };

	it("TC-AIAUD-191: the live English prompt keeps the Context line and ends with the note naming English", () => {
		// Act
		const turn = merchantUserMessage(context, ENGLISH_ASK);

		// Assert
		expect(turn).toContain("Reply language: English (from this message).");
		expect(turn.endsWith(replyLanguageNote("English") as string)).toBe(true);
		expect(turn).toContain(`\n\n${ENGLISH_ASK}\n\n[Platform note`);
		expect(turn).toMatch(/even if earlier messages in this chat were in another language/);
	});

	it("TC-AIAUD-191: a Malay message gets the Malay note (and no English one); an unclear message gets none", () => {
		const malay = merchantUserMessage(context, MALAY_TURN);
		expect(malay.endsWith(replyLanguageNote("Malay") as string)).toBe(true);
		expect(malay).not.toContain("English");
		expect(merchantUserMessage(context, "ok thanks")).not.toContain("Platform note");
		expect(merchantUserMessage(context, "Добавь баннер распродажи на главную страницу")).toContain("in the language of this message (Cyrillic script)");
	});

	it("TC-AIAUD-191: the note is not the merchant's request: its words load no tool group", () => {
		const turn = merchantUserMessage({ module: "orders", today: "2026-10-29" }, "Confirm the pending orders");
		expect(groupsInUserTurn(turn).has("website")).toBe(false);
		expect(groupsInUserTurn(turn).has("orders")).toBe(true);
	});
});

describe("wrongReplyLanguage [TC-AIAUD-192]", () => {
	it("TC-AIAUD-192: the live Malay reply under the English prompt is wrong; the English one is not", () => {
		expect(wrongReplyLanguage(ENGLISH_ASK, LIVE_MALAY_REPLY)).toBe("English");
		expect(wrongReplyLanguage(ENGLISH_ASK, ENGLISH_DECLINE)).toBeNull();
	});

	it("TC-AIAUD-192: a Malay prompt answered in Malay, an English reply to a Malay prompt, and Vietnamese", () => {
		expect(wrongReplyLanguage(MALAY_TURN, LIVE_MALAY_REPLY)).toBeNull();
		expect(wrongReplyLanguage(MALAY_TURN, "I changed the headline and it waits for your approval.")).toBe("Malay");
		expect(wrongReplyLanguage("Thêm banner khuyến mãi vào trang chủ của tôi", "I added the banner and it waits for your approval.")).toBe("Vietnamese");
		expect(wrongReplyLanguage(ENGLISH_ASK, "Tôi đã đề xuất bố cục hai cột cho máy tính và một cột cho điện thoại, chờ bạn duyệt.")).toBe("English");
	});

	it("TC-AIAUD-192: never judged: a language or translation request, short or mixed replies, an English reply quoting a Vietnamese name", () => {
		expect(wrongReplyLanguage("Translate the hero headline to Malay please", LIVE_MALAY_REPLY)).toBeNull();
		expect(wrongReplyLanguage(ENGLISH_ASK, "Siap!")).toBeNull();
		expect(wrongReplyLanguage(ENGLISH_ASK, "Done. The product is named “Áo dài cổ truyền” and it waits for your approval.")).toBeNull();
		expect(wrongReplyLanguage("ok thanks", LIVE_MALAY_REPLY)).toBeNull();
	});
});

describe("replyInLanguageOf — one rewrite on the fast model [TC-AIAUD-193]", () => {
	it("TC-AIAUD-193: a wrong-language reply is rewritten; the call names the language and carries the reply", async () => {
		// Arrange
		const fast = answering(ENGLISH_DECLINE);

		// Act
		const fixed = await replyInLanguageOf({ prompt: ENGLISH_ASK, reply: LIVE_MALAY_REPLY, model: fast });

		// Assert
		expect(fixed?.text).toBe(ENGLISH_DECLINE);
		expect(JSON.stringify(fast.doGenerateCalls[0]?.prompt)).toContain("Language: English");
		expect(JSON.stringify(fast.doGenerateCalls[0]?.prompt)).toContain("Saya telah mencadangkan");
	});

	it("TC-AIAUD-193: a reply in the right language makes no model call", async () => {
		const fast = answering("never used");

		expect(await replyInLanguageOf({ prompt: ENGLISH_ASK, reply: ENGLISH_DECLINE, model: fast })).toBeNull();
		expect(fast.doGenerateCalls).toHaveLength(0);
	});

	it("TC-AIAUD-193: a rewrite that is empty, far longer, or still in the wrong language is not used", async () => {
		const run = (value: string) => replyInLanguageOf({ prompt: ENGLISH_ASK, reply: LIVE_MALAY_REPLY, model: answering(value) });

		expect(await run("")).toBeNull();
		expect(await run("I can't set it. ".repeat(60))).toBeNull();
		expect(await run("Saya tidak boleh menetapkan susun atur itu daripada sembang ini dan tiada apa yang diubah.")).toBeNull();
	});
});

describe("the live sequence: a Malay turn, then the English mobile-reorder question [TC-AIAUD-194..195]", () => {
	const context = { module: "editor", filters: { site: "11", editingLanguage: "en", pagesWrittenIn: "en" } };

	it("TC-AIAUD-194: the model answers in Malay again; the merchant gets the English reply, and no chips are offered", async () => {
		// Arrange: turn 1 Malay; turn 2 the live Malay reply; the fast model rewrites (and would also be asked for chips)
		const fast = answering(ENGLISH_DECLINE);
		const { service, model, store, recorded } = runHarness({
			turns: [{ text: "Draf tajuk menunggu kelulusan anda." }, { text: LIVE_MALAY_REPLY }],
			fast,
			cacheRead: 500,
		});
		const first = await service.start(ctx, { prompt: MALAY_TURN, context }, () => undefined);
		// (the first turn's own chips came from this model)
		const callsBefore = fast.doGenerateCalls.length;
		const streamed: string[] = [];

		// Act
		const second = await service.start(ctx, { prompt: ENGLISH_ASK, threadId: first.threadId, context }, (frame) => {
			if (frame.type === "run.status" && frame.answer) streamed.push(frame.answer);
		});

		// Assert: the second turn closes with the English note, after the Malay history
		const lastUser = model.doGenerateCalls[1]?.prompt.at(-1);
		const sent = lastUser?.role === "user" && lastUser.content[0]?.type === "text" ? lastUser.content[0].text : "";
		expect(sent.endsWith(replyLanguageNote("English") as string)).toBe(true);
		// the stored and streamed answer is the English one
		expect(second.answer).toBe(ENGLISH_DECLINE);
		expect(streamed).toEqual([ENGLISH_DECLINE]);
		expect((await store.getRun("org_1", second.id))?.answer).toBe(ENGLISH_DECLINE);
		// one rewrite call, recorded under its own task; a declined reply gets no suggestion call
		expect(fast.doGenerateCalls.length - callsBefore).toBe(1);
		expect(recorded.filter((event) => event.task === REPLY_LANGUAGE_TASK)).toMatchObject([{ outcome: "ok", runId: second.id }]);
		expect(looksDeclined(second.answer)).toBe(true);
		expect(second.suggestions ?? []).toEqual([]);
	});

	it("TC-AIAUD-195: the first (Malay) turn and a reply already in the right language cost no extra call", async () => {
		const fast = answering("never used");
		const { service, recorded } = runHarness({ turns: [{ text: "Draf tajuk menunggu kelulusan anda." }, { text: ENGLISH_DECLINE }], fast });
		const first = await service.start(ctx, { prompt: MALAY_TURN, context }, () => undefined);

		const second = await service.start(ctx, { prompt: ENGLISH_ASK, threadId: first.threadId, context }, () => undefined);

		expect(second.answer).toBe(ENGLISH_DECLINE);
		expect(fast.doGenerateCalls).toHaveLength(0);
		expect(recorded.some((event) => event.task === REPLY_LANGUAGE_TASK)).toBe(false);
	});

	it("TC-AIAUD-195: when the rewrite call fails the model's own reply is kept (never an empty answer)", async () => {
		const fast = new MockLanguageModelV4({
			doGenerate: async () => {
				throw new Error("fast model down");
			},
		});
		const { service } = runHarness({ turns: [{ text: "Draf tajuk menunggu kelulusan anda." }, { text: LIVE_MALAY_REPLY }], fast });
		const first = await service.start(ctx, { prompt: MALAY_TURN, context }, () => undefined);

		const second = await service.start(ctx, { prompt: ENGLISH_ASK, threadId: first.threadId, context }, () => undefined);

		expect(second.status).toBe("applied");
		expect(second.answer).toBe(LIVE_MALAY_REPLY);
	});
});

describe("a section style is a name, never a layout promise [TC-AIAUD-196..198]", () => {
	const BLOCK = "00000000-0000-4000-8000-0000000000b1";
	const nulls = { afterBlockId: null, blockType: null, variant: null, fields: null, path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null } as const;
	const input = (op: Record<string, unknown>) => ({ siteId: "11", pageId: "75", why: "Change the hero", addToStore: null, keepWording: null, ops: [{ ...nulls, blockId: BLOCK, ...op }] as PagePatchToolInput["ops"] });
	const deps = (): MerchantToolDeps =>
		({
			runId: "run_1",
			newChangeSetId: () => "cs_abc123def456",
			now: () => new Date("2026-10-29T03:36:00Z"),
			stage: vi.fn(async () => undefined),
			productKnowledge: async () => ({}),
			images: () => [],
			allowEdit: () => true,
			seenProducts: () => [],
			createdInChat: () => [],
			siteRead: vi.fn(async () => ({})),
			sitePrepare: vi.fn(async () => ({
				kind: "site.page_patch" as const,
				title: "Edit page: Home",
				why: "Change the hero",
				risk: "low" as const,
				diffs: [{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "variant", before: "centered", after: "split-left" }],
				guardrails: [{ rule: "undo", ok: true, detail: "undo" }],
				plan: { siteId: "11", pageId: "75", ops: [], expect: {} },
			})),
		}) as unknown as MerchantToolDeps;
	const patch = (tools: ReturnType<typeof createMerchantTools>, body: unknown) =>
		(tools.propose_page_patch as unknown as { execute: (i: unknown, o: unknown) => Promise<{ note: string }> }).execute(body, { toolCallId: "t", messages: [] });

	it("TC-AIAUD-196: a staged style change tells the model it says only that the style changed, never how it looks on mobile", async () => {
		// Act
		const result = await patch(createMerchantTools(deps()), input({ op: "set_variant", variant: "split-left" }));

		// Assert
		expect(result.note).toMatch(/only a name/);
		expect(result.note).toMatch(/never how it looks on mobile or desktop/);
	});

	it("TC-AIAUD-196: a text edit carries no such note", async () => {
		const result = await patch(createMerchantTools(deps()), input({ op: "set_value", path: "headline", valueJson: '"Glow"' }));

		expect(result.note).not.toMatch(/only a name/);
	});

	it("TC-AIAUD-197: the website instructions forbid layout claims and workarounds, and ask for a plain decline", () => {
		expect(MERCHANT_INSTRUCTIONS).toMatch(/Layout you can't read or set/);
		expect(MERCHANT_INSTRUCTIONS).toMatch(/if the variant supports it/);
		expect(MERCHANT_INSTRUCTIONS).toMatch(/never offer another style or section as a way to get it/);
		expect(MERCHANT_INSTRUCTIONS).toMatch(/stage nothing, say in one or two sentences/);
	});

	it("TC-AIAUD-197: a deployment without the website tools does not carry the rule", () => {
		expect(merchantInstructions(capabilitySet(["shop_products"]))).not.toMatch(/Layout you can't read or set/);
	});

	it("TC-AIAUD-198: site_read's description says variants are names only", () => {
		const tools = createMerchantTools(deps());

		expect((tools.site_read as unknown as { description: string }).description).toMatch(/Section variants are names only/);
		expect((tools.propose_page_patch as unknown as { description: string }).description).toMatch(/set_variant; it sets no columns or mobile order/);
	});
});

