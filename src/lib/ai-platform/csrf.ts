/**
 * Same-origin check for state-changing requests to /api/agent/* and the legacy /api/ai/* routes: the
 * Origin (else Referer) host must be this host. A request with neither header is a non-browser client
 * and is let through; the session cookie still has to be valid.
 */
export function validateCsrf(req: Pick<Request, "headers">): boolean {
	const host = req.headers.get("host");
	const origin = req.headers.get("origin");
	if (!origin) {
		const referer = req.headers.get("referer");
		if (!referer) return true;
		try {
			return Boolean(host && new URL(referer).host === host);
		} catch {
			return false;
		}
	}
	try {
		return Boolean(host && new URL(origin).host === host);
	} catch {
		return false;
	}
}
