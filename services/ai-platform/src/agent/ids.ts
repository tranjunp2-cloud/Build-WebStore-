import { randomUUID } from "node:crypto";

/** `<prefix>_` + 20 random hex chars (run_, cs_, rcpt_, thr_ …). */
export function newId(prefix: string): string {
	return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
