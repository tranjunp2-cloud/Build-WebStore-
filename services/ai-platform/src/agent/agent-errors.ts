/** Domain errors mapped to HTTP problem details by the controller. */
export class AgentError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 402 | 403 | 404 | 409 | 413 | 429 | 503 | 504,
		/** Stable machine-readable reason when the status alone is ambiguous (402 → provider credit). */
		readonly code?: "provider_insufficient_quota",
	) {
		super(message);
		this.name = "AgentError";
	}
}
