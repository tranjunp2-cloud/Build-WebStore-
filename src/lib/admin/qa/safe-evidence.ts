import crypto from "crypto";

export function createQaEvidenceUrl(
  runId: string | number,
  baseUrl: string,
  secret: string,
  now = Date.now(),
): { url: string; expiresAt: string } {
  const expiresAt = new Date(now + 24 * 60 * 60_000).toISOString();
  const payload = `${runId}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const url = new URL(`/api/admin/qa/evidence/${encodeURIComponent(String(runId))}`, baseUrl);
  url.searchParams.set("expiresAt", expiresAt);
  url.searchParams.set("signature", signature);
  return { url: url.toString(), expiresAt };
}

export function verifyQaEvidenceLink(
  runId: string,
  expiresAt: string | null,
  signature: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!expiresAt || !signature || !/^\d+$/.test(runId) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs) || expiryMs <= now || expiryMs > now + 7 * 24 * 60 * 60_000) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${runId}.${expiresAt}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

/** Validates the server-issued metadata evidence URL before exposing it in Studio. */
export function isApprovedQaEvidenceUrl(
  value: string,
  expiresAt: string,
  baseUrl: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!baseUrl || !secret) return false;
  try {
    const url = new URL(value);
    const expected = new URL(baseUrl);
    const match = url.pathname.match(/^\/api\/admin\/qa\/evidence\/(\d+)$/);
    return (
      url.origin === expected.origin &&
      Boolean(match) &&
      url.searchParams.get("expiresAt") === expiresAt &&
      verifyQaEvidenceLink(match![1], expiresAt, url.searchParams.get("signature"), secret, now)
    );
  } catch {
    return false;
  }
}
