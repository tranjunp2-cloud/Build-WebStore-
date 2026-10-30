/** Domain errors mapped to HTTP problem details by the controller. */
export class AgentError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 402 | 403 | 404 | 409 | 413 | 429 | 503 | 504,
		/** Stable machine-readable reason when the status alone is ambiguous (402 → provider credit, 429 → provider rate limit vs the workspace limit). */
		readonly code?: "provider_insufficient_quota" | "provider_rate_limited",
	) {
		super(message);
		this.name = "AgentError";
	}
}
