function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // F42 stores public DNS hostnames. Reject IPv6 rather than attempting to
  // distinguish public from private/mapped IPv6 forms (for example
  // ::ffff:127.0.0.1) before embedding the URL in an administrator browser.
  if (host.includes(":")) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) return true;
  const octets = host.split(".").map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) return false;
  return (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

/**
 * Historical migration input is rendered in F40's isolated PW1 iframe.
 * Retain only a clean public HTTPS URL so it cannot target local/private
 * infrastructure, embed credentials, or leak query-string tokens.
 */
export function sanitizeMigrationSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      isPrivateOrLocalHost(url.hostname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}
