import type { ContextElement } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentChatThread, type AgentChatView } from "./chat";
import { ChatComposer } from "./composer";

// TC-AIWB-61 — Ask AI on an element: the element waits in the composer as a
// chip (kind + what it says, removable) and the sent message shows the same
// chip, so the merchant sees what went to the assistant.

const button: ContextElement = { kind: "button", label: "Mua ngay", blockId: "blk_hero", path: "ctaButtons.0.label", value: "Mua ngay" };
const seo: ContextElement = { kind: "seo", label: "Home", pageId: "7", path: "seoTitle" };

const chat: AgentChatView = {
	turns: [],
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

describe("element chips in the chat [TC-AIWB-61]", () => {
	it("the composer lists the waiting elements with their kind and a remove button, where the flight lands", () => {
		const html = renderToStaticMarkup(
			<ChatComposer
				attachments={[]}
				onFiles={() => undefined}
				onRemove={() => undefined}
				onPick={() => undefined}
				listMedia={async () => []}
				elements={{ items: [button, seo], onRemove: () => undefined }}
				canSend={() => true}
				onSend={() => undefined}
			/>,
		);

		expect(html).toContain("data-agent-elements");
		expect(html.match(/class="ech-ag-el"/g)).toHaveLength(2);
		expect(html).toContain("<b>Button</b><span>Mua ngay</span>");
		expect(html).toContain("<b>SEO</b><span>Home</span>");
		expect(html).toContain('aria-label="Remove Mua ngay"');
	});

	it("no elements waiting → no chips row", () => {
		const html = renderToStaticMarkup(
			<ChatComposer
				attachments={[]}
				onFiles={() => undefined}
				onRemove={() => undefined}
				onPick={() => undefined}
				listMedia={async () => []}
				elements={{ items: [], onRemove: () => undefined }}
				canSend={() => true}
				onSend={() => undefined}
			/>,
		);

		expect(html).not.toContain("data-agent-elements");
	});

	it("a sent message shows its elements as chips (no remove), in the host's words for the kind", () => {
		const html = renderToStaticMarkup(
			<AgentChatThread
				chat={{ ...chat, turns: [{ id: "u1", role: "user", text: "Hấp dẫn hơn", elements: [button] }] }}
				composerLabels={{ elementKinds: { text: "Chữ", button: "Nút", image: "Ảnh", section: "Mục", seo: "SEO", menu: "Menu", footer: "Chân trang", page: "Trang", product: "Sản phẩm", post: "Bài viết" } }}
			/>,
		);

		expect(html).toContain('class="ech-ag-u-els"');
		expect(html).toContain("<b>Nút</b><span>Mua ngay</span>");
		expect(html).not.toContain('aria-label="Remove Mua ngay"');
		expect(html).toContain("Hấp dẫn hơn");
	});
});
