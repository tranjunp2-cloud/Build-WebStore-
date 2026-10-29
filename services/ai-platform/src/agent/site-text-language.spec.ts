import { describe, expect, it, vi } from "vitest";
import { MERCHANT_INSTRUCTIONS } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps, type PagePatchToolInput } from "./merchant-tools";
import { confidentLanguage, summaryInScriptOf } from "./message-language";
import { ctx as runCtx, runHarness } from "./run-harness.spec-helper";
import { languageSwitches, languageSwitchRefusal } from "./site-text-language";

// TC-AIAUD-174..179 — B2 (#2103, live run run_353df399f4fd4472bbd7): a Malay chat turn, then "Make the hero
// subheadline shorter." on an English site. The card summary and the staged text came out Malay while the reply
// quoted an English sentence. The platform now keeps edited page text in the page's language and detects the
// Malay of a card line from the words such lines use.

// the exact values of the live run
const PROMPT = "Make the hero subheadline shorter.";
const BEFORE = "Shop gentle cleansers, vitamin C serum, daily moisturizer, and SPF50 sunscreen from Petaling Jaya, delivered across Malaysia.";
const MALAY_AFTER = "Penjagaan kulit harian yang lembut, dihantar ke seluruh Malaysia.";
const ENGLISH_AFTER = "Gentle daily skincare, delivered across Malaysia.";
const MALAY_WHY = "Memendekkan subheadline hero sahaja seperti diminta, tanpa mengubah harga produk atau halaman lain.";
const ENGLISH_NEUTRAL = "Review the changes below before approving.";

const diff = (after: string, before: string | null = BEFORE) => ({ entity: { label: "Hero · Home" }, field: "subheadline", before, after });

describe("the language of page copy and card lines [TC-AIAUD-174..175]", () => {
	it("TC-AIAUD-174: the live run's Malay card line and Malay subheadline are Malay; the old English text is English", () => {
		expect(confidentLanguage(MALAY_WHY)).toBe("ms");
		expect(confidentLanguage(MALAY_AFTER)).toBe("ms");
		expect(confidentLanguage(BEFORE)).toBe("en");
		// English with a Malay place or product name stays English / unclear
		expect(confidentLanguage("Nasi lemak and teh tarik, delivered to your door")).toBe("en");
		expect(confidentLanguage("Kek lapis Sarawak")).toBeNull();
	});

	it("TC-AIAUD-175: the live run's Malay summary under 'Make the hero subheadline shorter.' becomes the English line", () => {
		expect(summaryInScriptOf(MALAY_WHY, "Edit page: Home", PROMPT)).toBe(ENGLISH_NEUTRAL);
		// the same line under a Malay request stays
		expect(summaryInScriptOf(MALAY_WHY, "Edit page: Home", "Tolong pendekkan subheadline hero itu")).toBe(MALAY_WHY);
	});
});

describe("languageSwitches — new page text keeps the language of the text it replaces [TC-AIAUD-176..177]", () => {
	it("TC-AIAUD-176: the live run's Malay subheadline over the English one is a switch", () => {
		const [found] = languageSwitches([diff(MALAY_AFTER)], PROMPT, "en");

		expect(found).toMatchObject({ expected: "en", got: "ms", where: "Hero · Home → subheadline" });
	});

	it("TC-AIAUD-176: an English rewrite, a not-clear text and a new section are not switches", () => {
		expect(languageSwitches([diff(ENGLISH_AFTER)], PROMPT, "en")).toEqual([]);
		expect(languageSwitches([diff("Hubungi kami")], PROMPT, "en")).toEqual([]);
		expect(languageSwitches([diff(MALAY_AFTER, null)], PROMPT, "en")).toEqual([]);
		expect(languageSwitches([diff(MALAY_AFTER, "")], PROMPT, "en")).toEqual([]);
	});

	it("TC-AIAUD-176: with old text that does not show its language, the editor's language decides", () => {
		const before = "Skincare";
		expect(languageSwitches([diff(MALAY_AFTER, before)], PROMPT, "en")).toHaveLength(1);
		expect(languageSwitches([diff(MALAY_AFTER, before)], PROMPT, "ms-MY")).toEqual([]);
		expect(languageSwitches([diff(MALAY_AFTER, before)], PROMPT, undefined)).toEqual([]);
	});

	it("TC-AIAUD-176: a Malay site stays Malay (the old text decides over the chat language)", () => {
		const malaySite = "Penjagaan kulit untuk setiap hari, dihantar ke seluruh Malaysia dan semua negeri.";
		expect(languageSwitches([diff("Gentle skincare for every day, delivered to all of Malaysia", malaySite)], "Pendekkan subheadline hero itu", "ms")).toHaveLength(1);
		expect(languageSwitches([diff(MALAY_AFTER, malaySite)], PROMPT, "ms")).toEqual([]);
	});

	it("TC-AIAUD-177: the merchant's own words, a quoted phrase and a language / translation request are never switches", () => {
		// first turn of the live thread: the merchant typed the Malay headline
		const typed = "Tukar tajuk bahagian utama kepada 'Penjagaan Kulit Untuk Setiap Hari'. Jangan ubah harga produk atau halaman lain.";
		const headline = { entity: { label: "Hero · Home" }, field: "headline", before: "Hydrated, Comfortable Skin in Malaysian Humidity", after: "Penjagaan Kulit Untuk Setiap Hari" };
		expect(languageSwitches([headline], typed, "en")).toEqual([]);
		// the exact words are inside a longer text
		expect(languageSwitches([diff(`${MALAY_AFTER} Penjagaan Kulit Untuk Setiap Hari`)], "Add 'Penjagaan Kulit Untuk Setiap Hari' to the subheadline", "en")).toEqual([]);
		// a language or translation is asked for
		expect(languageSwitches([diff(MALAY_AFTER)], "Translate the hero subheadline to Malay", "en")).toEqual([]);
		expect(languageSwitches([diff(MALAY_AFTER)], "Tukar subheadline hero dalam Bahasa Melayu", "en")).toEqual([]);
		expect(languageSwitches([diff(MALAY_AFTER)], "Dịch phần phụ đề sang tiếng Mã Lai", "en")).toEqual([]);
	});

	it("TC-AIAUD-176: the refusal names both languages and the one to write in", () => {
		const out = languageSwitchRefusal(languageSwitches([diff(MALAY_AFTER)], PROMPT, "en"));

		expect(out.error.code).toBe("wrong_language");
		expect(out.error.message).toMatch(/new text is Malay, the page is English/);
		expect(out.error.message).toMatch(/rewrite the new text in English/);
	});
});

const BLOCK = "00000000-0000-4000-8000-0000000000b1";
const nulls = { afterBlockId: null, blockType: null, variant: null, fields: null, path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null } as const;
const subheadline = (text: string) => ({
	siteId: "11",
	pageId: "75",
	why: "Shorter hero subheadline",
	addToStore: null,
	keepWording: null,
	ops: [{ ...nulls, op: "set_value", blockId: BLOCK, path: "subheadline", valueJson: JSON.stringify(text) }] as PagePatchToolInput["ops"],
});

const prepared = (after: string) => ({
	kind: "site.page_patch" as const,
	title: "Edit page: Home",
	why: "Shorter hero subheadline",
	risk: "low" as const,
	diffs: [{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "subheadline", before: BEFORE, after }],
	guardrails: [{ rule: "undo", ok: true, detail: "undo" }],
	plan: { siteId: "11", pageId: "75", ops: [], expect: {} },
});

function toolDeps(overrides: Partial<MerchantToolDeps> = {}): MerchantToolDeps {
	return {
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
		sitePrepare: vi.fn(async (_kind, input) => prepared(String((input.ops as Array<{ value?: string }>)[0]?.value))),
		siteText: () => ({ request: PROMPT, editingLanguage: "en" }),
		...overrides,
	} as unknown as MerchantToolDeps;
}

const patch = (tools: ReturnType<typeof createMerchantTools>, input: unknown) =>
	(tools.propose_page_patch as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: "t", messages: [] });

describe("propose_page_patch keeps the page's language [TC-AIAUD-178]", () => {
	it("TC-AIAUD-178: Malay text over the English subheadline is refused with the language to use, then the English rewrite is staged", async () => {
		// Arrange
		const d = toolDeps();
		const tools = createMerchantTools(d);

		// Act
		const refused = await patch(tools, subheadline(MALAY_AFTER));
		const staged = await patch(tools, subheadline(ENGLISH_AFTER));

		// Assert
		expect(refused).toMatchObject({ error: { code: "wrong_language" } });
		expect(staged).toMatchObject({ changeSetId: "cs_abc123def456", changes: 1 });
		expect(d.stage).toHaveBeenCalledTimes(1);
		const card = (d.stage as ReturnType<typeof vi.fn>).mock.calls[0]![0];
		expect(card.diffs[0].after).toBe(ENGLISH_AFTER);
		expect(card.guardrails.filter((g: { rule: string }) => g.rule === "text_language")).toEqual([]);
	});

	it("TC-AIAUD-178: the same Malay text sent again is staged, with a note on the card (the merchant may have meant it)", async () => {
		// Arrange
		const d = toolDeps();
		const tools = createMerchantTools(d);
		await patch(tools, subheadline(MALAY_AFTER));

		// Act
		const again = await patch(tools, subheadline(MALAY_AFTER));

		// Assert
		expect(again).toMatchObject({ changeSetId: "cs_abc123def456" });
		const card = (d.stage as ReturnType<typeof vi.fn>).mock.calls[0]![0];
		expect(card.guardrails).toContainEqual({ rule: "text_language", ok: false, detail: "Hero · Home → subheadline: written in Malay, the page text is English." });
		expect(again.skipped).toEqual([expect.stringContaining("written in Malay")]);
	});

	it("TC-AIAUD-178: nothing changes without the run's context, for theme changes, or when the text is the merchant's own", async () => {
		const bare = toolDeps({ siteText: undefined });
		expect(await patch(createMerchantTools(bare), subheadline(MALAY_AFTER))).toMatchObject({ changeSetId: "cs_abc123def456" });

		const typed = toolDeps({ siteText: () => ({ request: `Tukar subheadline kepada '${MALAY_AFTER}'`, editingLanguage: "en" }) });
		expect(await patch(createMerchantTools(typed), subheadline(MALAY_AFTER))).toMatchObject({ changeSetId: "cs_abc123def456" });
	});

	it("TC-AIAUD-178: the instructions tell the model the page keeps its language and the reply quotes the staged text", () => {
		expect(MERCHANT_INSTRUCTIONS).toMatch(/an earlier Malay turn does not make the page Malay/);
		expect(MERCHANT_INSTRUCTIONS).toMatch(/wrong_language/);
		expect(MERCHANT_INSTRUCTIONS).toMatch(/quote it exactly as staged/);
	});
});

describe("the live sequence: a Malay turn, then an English request on the English site [TC-AIAUD-179]", () => {
	it("TC-AIAUD-179: Malay text is refused, the model rewrites in English, the card and its summary are English", async () => {
		// Arrange: turn 1 = the typed Malay headline; turn 2 = Malay subheadline (refused) then the English one
		const sitePrepare = vi.fn(async (_ctx: unknown, _kind: unknown, input: Record<string, unknown>) => {
			const value = String((input.ops as Array<{ value?: string }>)[0]?.value);
			const isHeadline = (input.ops as Array<{ path?: string }>)[0]?.path === "headline";
			return {
				...prepared(value),
				why: String(input.why),
				diffs: [{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: isHeadline ? "headline" : "subheadline", before: isHeadline ? "Hydrated, Comfortable Skin in Malaysian Humidity" : BEFORE, after: value }],
			};
		});
		const headlineInput = { ...subheadline("Penjagaan Kulit Untuk Setiap Hari"), ops: [{ ...nulls, op: "set_value", blockId: BLOCK, path: "headline", valueJson: '"Penjagaan Kulit Untuk Setiap Hari"' }] };
		const { service, store, model } = runHarness({
			turns: [
				{ tool: "propose_page_patch", input: headlineInput },
				{ text: "Draf tajuk menunggu kelulusan anda." },
				{ tool: "propose_page_patch", input: { ...subheadline(MALAY_AFTER), why: MALAY_WHY } },
				{ tool: "propose_page_patch", input: { ...subheadline(ENGLISH_AFTER), why: MALAY_WHY } },
				{ text: `I staged a shorter hero subheadline: “${ENGLISH_AFTER}” It’s waiting for your approval.` },
			],
			shop: { sitePrepare },
		});
		const context = { module: "editor", filters: { site: "11", editingLanguage: "en", pagesWrittenIn: "en" } };
		const first = await service.start(
			runCtx,
			{ prompt: "Tukar tajuk bahagian utama kepada 'Penjagaan Kulit Untuk Setiap Hari'. Jangan ubah harga produk atau halaman lain.", context },
			() => undefined,
		);

		// Act
		const second = await service.start(runCtx, { prompt: PROMPT, threadId: first.threadId, context }, () => undefined);

		// Assert: the typed Malay headline went through; the Malay subheadline never reached a card
		const [headlineCard] = await store.listRunChangeSets("org_1", first.id);
		expect(headlineCard?.diffs[0]?.after).toBe("Penjagaan Kulit Untuk Setiap Hari");
		const cards = await store.listRunChangeSets("org_1", second.id);
		expect(cards).toHaveLength(1);
		expect(cards[0]?.diffs[0]?.after).toBe(ENGLISH_AFTER);
		// the Malay card line under an English request is the English platform line
		expect(cards[0]?.summary).toBe(ENGLISH_NEUTRAL);
		expect(model.doGenerateCalls.length).toBeGreaterThanOrEqual(4);
	});
});
