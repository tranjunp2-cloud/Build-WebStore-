import type { AgentRun } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentChatThread } from "./chat";
import { RunMedia, runMedia } from "./run-media";

// TC-AICP-60 — pictures a reply read or made show under it: each once, only
// same-origin or http(s) URLs, opening the full DAM preview.

const run = {
	id: "run_1",
	changeSetIds: [],
	receipts: [
		{ id: "r1", tool: "content.read", summary: "", durationMs: 1, status: "ok", entityIds: [], media: [{ url: "/api/media/file/cover.jpg", alt: "Cover photo", label: "Cover" }] },
		{
			id: "r2",
			tool: "media.generate_image",
			summary: "",
			durationMs: 1,
			status: "ok",
			entityIds: [],
			media: [
				{ url: "/api/agent/media/assets/ast_9/thumbnail", label: "Generated", imageId: "img_1" },
				{ url: "/api/media/file/cover.jpg", imageId: "img_1" },
				{ url: "javascript:alert(1)", imageId: "img_2" },
				{ url: "//evil.example/x.png", imageId: "img_3" },
			],
		},
	],
} as unknown as AgentRun;

describe("RunMedia [TC-AICP-60]", () => {
	it("shows what the run generated, else what it read — each safe picture once", () => {
		expect(runMedia(run).map((m) => m.url)).toEqual(["/api/agent/media/assets/ast_9/thumbnail", "/api/media/file/cover.jpg"]);
		const readOnly = { ...run, changeSetIds: [], receipts: [run.receipts[0], run.receipts[0]] } as AgentRun;
		expect(runMedia(readOnly).map((m) => m.url)).toEqual(["/api/media/file/cover.jpg"]);
		// a read that led to a staged change shows no pictures — the card carries the change
		expect(runMedia({ ...readOnly, changeSetIds: ["cs_1"] } as AgentRun)).toEqual([]);
		expect(runMedia(undefined)).toEqual([]);
	});

	it("renders labelled tiles that open the full picture in a new tab", () => {
		const html = renderToStaticMarkup(<RunMedia items={runMedia(run)} />);
		expect(html).toContain('href="/api/agent/media/assets/ast_9/preview"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('<span class="ech-ag-pic-label">Generated</span>');
		expect(html).not.toContain("is-single");
		expect(renderToStaticMarkup(<RunMedia items={[]} />)).toBe("");
		expect(renderToStaticMarkup(<RunMedia items={runMedia(run).slice(0, 1)} />)).toContain("ech-ag-pics is-single");
	});

	it("offers Use this on pictures the run can place, and only when asked to", () => {
		const items = [
			{ url: "https://cdn.pixabay.com/a.jpg", label: "Pixabay · congerdesign", imageId: "img_4" },
			{ url: "/api/media/file/cover.jpg", label: "Cover" },
		];
		const html = renderToStaticMarkup(<RunMedia items={items} onUse={() => undefined} useLabel="Dùng ảnh này" />);
		expect(html.match(/ech-ag-pic-use/g)).toHaveLength(1);
		expect(html).toContain(">Dùng ảnh này<");
		expect(renderToStaticMarkup(<RunMedia items={items} />)).not.toContain("ech-ag-pic-use");
	});
});

// TC-AICP-129 — what "Use this" picked shows as a picture, not an id: the tile is marked
// chosen (its button takes it back) and the message that sent it carries the thumbnail.
describe("chosen pictures show as pictures [TC-AICP-129]", () => {
	const items = [
		{ url: "https://cdn.pixabay.com/7.jpg", label: "Pixabay · a", imageId: "img_35", ref: "pixabay:7" },
		{ url: "https://cdn.pixabay.com/8.jpg", label: "Pixabay · b", imageId: "img_36", ref: "pixabay:8" },
	];

	it("marks the chosen tile and labels its button", () => {
		const html = renderToStaticMarkup(<RunMedia items={items} chosen={new Set(["img_36"])} chosenLabel="Đã chọn" useLabel="Dùng ảnh này" onUse={() => undefined} />);
		expect(html.match(/class="ech-ag-pic is-chosen"/g)).toHaveLength(1);
		expect(html).toContain('aria-pressed="true">✓ Đã chọn<');
		expect(html).toContain('aria-pressed="false">Dùng ảnh này<');
	});

	it("shows the chosen pictures on the message that sent them", () => {
		const chat = {
			turns: [{ id: "u1", role: "user" as const, text: "Dùng ảnh này", pictures: [items[0]!] }],
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
		const html = renderToStaticMarkup(<AgentChatThread chat={chat} />);
		expect(html).toContain('class="ech-ag-th is-chosen"');
		expect(html).toContain("https://cdn.pixabay.com/7.jpg");
		expect(html).not.toContain("img_35<");
	});
});

// TC-AICP-134 — photos picked in a question card are the merchant's answer: the reply does not
// show them again as pictures to "Use" (they stay in the receipt, usable by id later in the chat).
describe("picked photos are not shown again [TC-AICP-134]", () => {
	it("leaves the question card's picks out and keeps found pictures", () => {
		const picked = {
			id: "run_2",
			changeSetIds: [],
			receipts: [
				{ id: "r1", tool: "catalog.ask_user", summary: "", durationMs: 0, status: "ok", entityIds: [], media: [{ url: "https://cdn.pixabay.com/1.jpg", label: "Pixabay · a", imageId: "img_1" }] },
				{ id: "r2", tool: "media.find_images", summary: "", durationMs: 1, status: "ok", entityIds: [], media: [{ url: "https://cdn.pixabay.com/2.jpg", imageId: "img_2" }] },
			],
		} as unknown as AgentRun;

		expect(runMedia(picked).map((m) => m.imageId)).toEqual(["img_2"]);
	});
});
