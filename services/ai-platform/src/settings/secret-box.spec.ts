import { describe, expect, it } from "vitest";
import { keyVersionOf, openSecret, sealSecret, secretIkm } from "./secret-box";

const IKM = "test-context-secret-at-least-32-characters";

describe("secret box [TC-AIPROV-01]", () => {
	it("TC-AIPROV-01: seals and opens a key, keeping only the last 4 characters in the clear", () => {
		// Arrange
		const key = "sk-live-abcdefghijklmnop1234";

		// Act
		const sealed = sealSecret(key, IKM, "provider:openai");

		// Assert
		expect(JSON.stringify(sealed)).not.toContain(key);
		expect(sealed.last4).toBe("1234");
		expect(sealed.keyVersion).toBe(keyVersionOf(IKM));
		expect(openSecret(sealed, IKM, "provider:openai")).toBe(key);
	});

	it("TC-AIPROV-01: every seal uses a fresh iv", () => {
		const a = sealSecret("sk-same-key-value", IKM, "provider:openai");
		const b = sealSecret("sk-same-key-value", IKM, "provider:openai");
		expect(a.iv).not.toBe(b.iv);
		expect(a.ciphertext).not.toBe(b.ciphertext);
	});

	it("TC-AIPROV-02: a secret sealed under another key cannot be opened (needs re-entry), not a crash", () => {
		const sealed = sealSecret("sk-live-abcdefghijklmnop1234", IKM, "provider:openai");
		expect(openSecret(sealed, "another-secret-another-secret-another-1", "provider:openai")).toBeNull();
	});

	it("TC-AIPROV-02: a tampered ciphertext or a secret moved to another row is refused", () => {
		const sealed = sealSecret("sk-live-abcdefghijklmnop1234", IKM, "provider:openai");
		const tampered = { ...sealed, ciphertext: Buffer.from("x".repeat(sealed.ciphertext.length)).toString("base64") };
		expect(openSecret(tampered, IKM, "provider:openai")).toBeNull();
		expect(openSecret(sealed, IKM, "provider:anthropic")).toBeNull();
	});

	it("TC-AIPROV-03: AI_PROVIDER_SECRETS_KEY is preferred over the context secret", () => {
		expect(secretIkm({ AI_PLATFORM_CONTEXT_SECRET: IKM })).toBe(IKM);
		expect(secretIkm({ AI_PLATFORM_CONTEXT_SECRET: IKM, AI_PROVIDER_SECRETS_KEY: "dedicated-secret-dedicated-secret-123" })).toBe("dedicated-secret-dedicated-secret-123");
		expect(keyVersionOf(IKM)).toMatch(/^[0-9a-f]{8}$/);
	});
});
