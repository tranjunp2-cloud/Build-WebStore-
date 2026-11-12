import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

/**
 * Provider keys saved in Prime Studio live in ai-platform's own database, sealed with AES-256-GCM.
 * Key = HKDF-SHA256(ikm = AI_PROVIDER_SECRETS_KEY, else AI_PLATFORM_CONTEXT_SECRET; salt "ech-ai-platform";
 * info "ai-provider-secrets-v1"). Each secret records the first 8 hex of SHA-256(ikm): after the ikm changed
 * it cannot be opened ("needs re-entry") and is treated as no key, never as a crash.
 */
const SALT = "ech-ai-platform";
const INFO = "ai-provider-secrets-v1";

export interface SealedSecret {
	ciphertext: string;
	iv: string;
	tag: string;
	last4: string;
	keyVersion: string;
}

export function secretIkm(env: { AI_PROVIDER_SECRETS_KEY?: string; AI_PLATFORM_CONTEXT_SECRET: string }): string {
	return env.AI_PROVIDER_SECRETS_KEY || env.AI_PLATFORM_CONTEXT_SECRET;
}

export function keyVersionOf(ikm: string): string {
	return createHash("sha256").update(ikm).digest("hex").slice(0, 8);
}

function deriveKey(ikm: string): Buffer {
	return Buffer.from(hkdfSync("sha256", ikm, SALT, INFO, 32));
}

/** `slot` (e.g. "provider:openai") is authenticated with the ciphertext: a sealed key cannot be moved to another row. */
export function sealSecret(plaintext: string, ikm: string, slot: string): SealedSecret {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", deriveKey(ikm), iv);
	cipher.setAAD(Buffer.from(slot));
	const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	return {
		ciphertext: ciphertext.toString("base64"),
		iv: iv.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
		last4: plaintext.slice(-4),
		keyVersion: keyVersionOf(ikm),
	};
}

/** The plaintext, or null when the secret was sealed under another key (or was tampered with). */
export function openSecret(sealed: SealedSecret, ikm: string, slot: string): string | null {
	if (sealed.keyVersion !== keyVersionOf(ikm)) return null;
	try {
		const decipher = createDecipheriv("aes-256-gcm", deriveKey(ikm), Buffer.from(sealed.iv, "base64"));
		decipher.setAAD(Buffer.from(slot));
		decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
		return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
	} catch {
		return null;
	}
}
