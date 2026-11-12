import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { errorDetailOf, MAX_ERROR_DETAIL, redactErrorDetail } from "./error-detail";

// TC-AICP-366 — the detail a failed call leaves on its usage row: name, status, the provider's message; keys masked.

const apiError = (statusCode: number, message: string) =>
	new APICallError({ message, url: "https://api.anthropic.com/v1/messages", requestBodyValues: {}, statusCode, isRetryable: statusCode >= 500 });

describe("error detail [TC-AICP-366]", () => {
	it("names the error, the HTTP status and the provider's message", () => {
		expect(errorDetailOf(apiError(400, "This model does not support assistant message prefill."))).toBe(
			"AI_APICallError 400: This model does not support assistant message prefill.",
		);
	});

	it("reads through the SDK's retry wrapper to the last error", () => {
		const retried = new RetryError({ message: "Failed after 2 attempts", reason: "maxRetriesExceeded", errors: [apiError(529, "Overloaded"), apiError(529, "Overloaded")] });
		expect(errorDetailOf(retried)).toBe("AI_APICallError 529: Overloaded");
	});

	it("masks keys and tokens a provider echoes back", () => {
		const detail = redactErrorDetail(
			"Incorrect API key provided: sk-proj-abcdefghijklmnop. Bearer eyJhbGciOiJIUzI1NiJ9.payload key=AIzaSyA1234567890abcdefghijk api_key: hunter2secret",
		);
		expect(detail).not.toMatch(/abcdefghijklmnop|eyJhbGci|AIzaSyA1234567890|hunter2secret/);
		expect(detail).toContain("sk-[redacted]");
	});

	it("keeps one line, at most the row's limit", () => {
		const detail = redactErrorDetail(`line one\n\nline two ${"x".repeat(2_000)}`);
		expect(detail.startsWith("line one line two")).toBe(true);
		expect(detail.length).toBeLessThanOrEqual(MAX_ERROR_DETAIL);
	});

	it("describes a plain error and a non-error value", () => {
		expect(errorDetailOf(new TypeError("fetch failed"))).toBe("TypeError: fetch failed");
		expect(errorDetailOf("boom")).toBe("boom");
	});
});
