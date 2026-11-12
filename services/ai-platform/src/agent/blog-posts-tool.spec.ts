import { type ChangeSet, ChangeSetSchema } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import { createCampaignRun } from "./campaign-group";
import type { KnownImage } from "./change-set-builders";
import { capabilitySet } from "./merchant-capabilities";
import { type BlogPostsWriteInput, type BlogPostWritten, createMerchantTools, type MerchantToolDeps } from "./merchant-tools";

// TC-AIWB-127 — "write 3 posts": the copilot plans the set, the platform writes each article and stages one linked card per post.
const article = (title: string): BlogPostWritten => ({
	ok: true,
	contentHtml: `<p>Intro for ${title}.</p><h2>One</h2><p>${"Words about it. ".repeat(20)}</p><h2>Two</h2><p>More words.</p>`,
	seoTitle: title.slice(0, 60),
	seoDescription: `What you learn in ${title}, in short.`,
});
const cover: KnownImage = { id: "img_1", ref: "pixabay:7", url: "https://cdn.pixabay.com/7.jpg", origin: "stock", alt: "Rain on a window", credit: "Pixabay" };
const post = (title: string, extra: Partial<{ notes: string | null; coverImageId: string | null }> = {}) => ({
	title,
	outline: ["Why it matters", "What to do"],
	notes: null,
	coverImageId: null,
	...extra,
});
const input = (posts = [post("Keep batik bright in the rain"), post("Drying silk the right way"), post("Storing scarves for the monsoon")]) => ({
	locale: "en",
	label: "Rainy season tips",
	posts,
});

function setup(over: Partial<MerchantToolDeps> = {}) {
	const staged: ChangeSet[] = [];
	let n = 0;
	const deps = {
		runId: "run_1",
		newChangeSetId: () => `cs_${++n}`,
		now: () => new Date("2026-10-30T08:00:00Z"),
		stage: vi.fn(async (changeSet: ChangeSet) => void staged.push(changeSet)),
		images: () => [cover],
		createdInChat: () => [],
		allowEdit: () => true,
		writeBlogPosts: vi.fn(async ({ posts }: { posts: ReadonlyArray<{ title: string }> }) => posts.map((p) => article(p.title))),
		...over,
	} as unknown as MerchantToolDeps;
	const tools = createMerchantTools(deps, capabilitySet(["blog", "stock_photos", "campaigns"])) as unknown as Record<string, { execute: (input: unknown) => Promise<any> }>;
	return { deps, staged, run: (value: unknown) => tools.propose_blog_posts!.execute(value) };
}

describe("propose_blog_posts [TC-AIWB-127]", () => {
	it("writes every planned post in one call and stages one linked blog draft card per post", async () => {
		// Arrange
		const { deps, staged, run } = setup();
		const planned = input([post("Keep batik bright in the rain", { notes: "Wash in cold water, RM5 soap", coverImageId: "img_1" }), post("Drying silk the right way")]);

		// Act
		const out = await run(planned);

		// Assert
		expect(deps.writeBlogPosts).toHaveBeenCalledTimes(1);
		expect(deps.writeBlogPosts).toHaveBeenCalledWith({
			locale: "en",
			posts: [
				{ title: "Keep batik bright in the rain", outline: ["Why it matters", "What to do"], notes: "Wash in cold water, RM5 soap" },
				{ title: "Drying silk the right way", outline: ["Why it matters", "What to do"], notes: null },
			],
		});
		expect(staged).toHaveLength(2);
		for (const changeSet of staged) expect(ChangeSetSchema.safeParse(changeSet).success).toBe(true);
		expect(staged.map((c) => c.action?.kind)).toEqual(["blog.create_draft", "blog.create_draft"]);
		expect(staged.map((c) => (c.action?.payload as { title: string }).title)).toEqual(["Keep batik bright in the rain", "Drying silk the right way"]);
		expect(staged[0]!.group).toEqual({ id: staged[1]!.group!.id, label: "Rainy season tips", kind: "set", step: 1 });
		expect(staged[1]!.group).toMatchObject({ kind: "set", step: 2 });
		expect((staged[0]!.action?.payload as { cover?: { ref: string } }).cover?.ref).toBe("pixabay:7");
		expect(out).toEqual({ changeSetIds: staged.map((c) => c.id), posts: 2, note: "Staged for the merchant's approval. Nothing has been created yet." });
	});

	it("stages the posts that were written and names the ones that were not", async () => {
		// Arrange
		const { staged, run } = setup({
			writeBlogPosts: vi.fn(async ({ posts }: BlogPostsWriteInput) =>
				posts.map((p, i): BlogPostWritten => (i === 1 ? { ok: false, reason: "The AI is busy right now. Try again in a minute." } : article(p.title))),
			),
		});

		// Act
		const out = await run(input());

		// Assert
		expect(staged).toHaveLength(2);
		expect(staged.map((c) => c.group?.step)).toEqual([1, 2]);
		expect(out.failed).toEqual([{ title: "Drying silk the right way", reason: "The AI is busy right now. Try again in a minute." }]);
	});

	it("lets a running campaign link the posts instead of a set of their own", async () => {
		// Arrange
		const holder: { campaign?: Parameters<typeof createCampaignRun>[1]["campaign"] } = {};
		const campaign = createCampaignRun("run_1", holder);
		campaign.begin("11.11");
		const { staged, run } = setup({ campaign });

		// Act
		await run(input([post("Our 11.11 picks"), post("How the 11.11 code works")]));

		// Assert
		expect(staged.map((c) => c.group)).toEqual([
			{ id: "cmp_run_1_1", label: "11.11", step: 1 },
			{ id: "cmp_run_1_1", label: "11.11", step: 2 },
		]);
	});

	it("skips a post already created in this chat and drafts the rest", async () => {
		// Arrange
		const { deps, staged, run } = setup({ createdInChat: () => [{ kind: "blog_post", id: "88", label: "Keep batik bright in the rain" }] });

		// Act
		const out = await run(input());

		// Assert
		expect((deps.writeBlogPosts as ReturnType<typeof vi.fn>).mock.calls[0]![0].posts.map((p: { title: string }) => p.title)).toEqual([
			"Drying silk the right way",
			"Storing scarves for the monsoon",
		]);
		expect(staged).toHaveLength(2);
		expect(out.alreadyCreated).toEqual(["Keep batik bright in the rain"]);
	});

	it("answers unavailable where the platform cannot write posts", async () => {
		// Arrange
		const { staged, run } = setup({ writeBlogPosts: undefined });

		// Act
		const out = await run(input());

		// Assert
		expect(out.error.code).toBe("unavailable");
		expect(staged).toHaveLength(0);
	});
});
