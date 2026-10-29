import { describe, expect, it } from "vitest";
import { DEFAULT_CHAT_LABELS, phraseText } from "./chat";
import { CHAT_PHRASES } from "./locales/chat-phrases";

// TC-AICP-81 — what the assistant did reads in the merchant's language: steps and
// receipts translate by phrase key (subject / count appended), unknown keys fall back
// to the server's English, and every shipped locale covers every key.

const vi = { phrases: { ...DEFAULT_CHAT_LABELS.phrases, ...CHAT_PHRASES.vi } };

describe("phraseText [TC-AICP-81]", () => {
	it("translates steps and receipts, keeping what they read or found", () => {
		expect(phraseText({ key: "step.thinking" }, "Thinking", vi)).toBe("Đang suy nghĩ");
		expect(phraseText({ key: "inventory.overview" }, "Checked what needs attention", vi)).toBe("Đã xem những việc cần chú ý");
		expect(phraseText({ key: "content.read.post", values: { subject: "Batik care" } }, "x", vi)).toBe("Đã đọc bài viết: Batik care");
		expect(phraseText({ key: "content.search.product", values: { n: 2 } }, "x", vi)).toBe("Đã xem qua sản phẩm của bạn (tìm thấy 2)");
		expect(phraseText({ key: "media.stock", values: { n: 4, subject: "linen" } }, "x", vi)).toBe("Tìm được 4 ảnh stock cho “linen”");
		expect(phraseText({ key: "ask.done", values: { asked: 3, auto: 2, family: "Áo" } }, "x", vi)).toBe("Nhóm: Áo · Đã hỏi 3 · 2 mục chọn sẵn từ danh mục");
	});

	it("falls back to the server's English", () => {
		expect(phraseText(undefined, "Read the post: X", vi)).toBe("Read the post: X");
		expect(phraseText({ key: "something.new" }, "Did something new", vi)).toBe("Did something new");
	});

	it("every locale covers every phrase", () => {
		const keys = Object.keys(DEFAULT_CHAT_LABELS.phrases).sort();
		for (const phrases of Object.values(CHAT_PHRASES)) expect(Object.keys(phrases).sort()).toEqual(keys);
	});
});
