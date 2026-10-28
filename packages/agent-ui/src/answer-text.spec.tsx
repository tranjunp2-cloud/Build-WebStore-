import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerText } from "./answer-text";

// TC-AICP-56 — a long reply (a review) reads as text: paragraphs, lists, bold and
// code render; markup in the reply stays text.

describe("AnswerText [TC-AICP-56]", () => {
	it("renders the review shape the copilot writes", () => {
		const html = renderToStaticMarkup(
			<AnswerText text={"**Verdict:** clear structure.\n\n**Fix first:**\n1. Replace the alt `photo.jpg`.\n2. Add a category.\n\n- one\n- two"} />,
		);
		expect(html).toBe(
			'<p><strong>Verdict:</strong> clear structure.</p><p><strong>Fix first:</strong></p>' +
				'<ol class="ech-ag-list"><li>Replace the alt <code>photo.jpg</code>.</li><li>Add a category.</li></ol>' +
				'<ul class="ech-ag-list"><li>one</li><li>two</li></ul>',
		);
	});

	it("never turns reply text into markup or links", () => {
		const html = renderToStaticMarkup(<AnswerText text={'<img src=x onerror="alert(1)"> [link](javascript:alert(1)) **<b>x</b>**'} />);
		expect(html).not.toContain("<img");
		expect(html).not.toContain("<a");
		expect(html).toContain("&lt;img");
		expect(html).toContain("<strong>&lt;b&gt;x&lt;/b&gt;</strong>");
	});
});
