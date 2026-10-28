import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentAssistantPanel } from "./assistant-panel";

// TC-AICP-291 — a new chat opens like a conversation: the greeting is the assistant's first
// message and the starters are short chips under it (all of them in one wrapping row group).

const chat = {
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
	elements: [],
	removeElement: () => undefined,
} as never;

describe("new chat starters [TC-AICP-291]", () => {
	it("TC-AICP-291: shows the greeting as a message and up to 4 starter chips, sending the full prompt", () => {
		// Arrange
		const suggestions = [
			{ label: "Friendlier hero", prompt: "Rewrite the top section to sound friendlier" },
			{ label: "Add a FAQ", prompt: "Add a FAQ section with 4 questions about my shop" },
			{ label: "Check SEO", prompt: "Check this page's SEO" },
			{ label: "Translate page", prompt: "Translate this page" },
			{ label: "Fifth", prompt: "Fifth" },
		];

		// Act
		const html = renderToStaticMarkup(<AgentAssistantPanel placement="inline" chat={chat} pending={[]} onDecide={async (c) => c} suggestions={suggestions} />);

		// Assert
		expect(html).toContain('class="ech-ag-starters"');
		expect(html).toContain('class="ech-ag-hello-bubble"');
		expect(html.match(/class="ech-ag-starter"/g)).toHaveLength(4);
		expect(html).toContain('title="Rewrite the top section to sound friendlier"');
		expect(html).toContain(">Friendlier hero<");
		expect(html).not.toContain(">Fifth<");
		expect(html).not.toContain(">Try<");
	});
});
