/**
 * Minimal SSE reader for fetch() response bodies. EventSource can't POST, and
 * a run is started with a POST whose response streams that run's events —
 * so the stream is parsed by hand: frames are separated by a blank line and
 * every `data:` line of a frame is joined with "\n" (per the SSE spec).
 */
export async function readSseStream(
	body: ReadableStream<Uint8Array>,
	onData: (data: string) => void,
	signal?: AbortSignal,
): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const onAbort = () => {
		void reader.cancel().catch(() => undefined);
	};
	signal?.addEventListener("abort", onAbort, { once: true });
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			buffer = buffer.replace(/\r\n?/g, "\n");
			let boundary = buffer.indexOf("\n\n");
			while (boundary >= 0) {
				const frame = buffer.slice(0, boundary);
				buffer = buffer.slice(boundary + 2);
				const data = frameData(frame);
				if (data !== null) onData(data);
				boundary = buffer.indexOf("\n\n");
			}
		}
		const tail = frameData(buffer + decoder.decode());
		if (tail !== null) onData(tail);
	} finally {
		signal?.removeEventListener("abort", onAbort);
	}
}

function frameData(frame: string): string | null {
	const lines = frame.split("\n").filter((line) => line.startsWith("data:"));
	if (lines.length === 0) return null;
	return lines.map((line) => line.slice(line.startsWith("data: ") ? 6 : 5)).join("\n");
}

/** Problem-details aware error so surfaces can show the server's reason. */
export class AgentGatewayError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "AgentGatewayError";
	}
}

export async function gatewayErrorFrom(response: Response, label: string): Promise<AgentGatewayError> {
	let detail: string | undefined;
	try {
		const body = (await response.json()) as { detail?: unknown; title?: unknown; message?: unknown };
		const candidate = body.detail ?? body.message ?? body.title;
		if (typeof candidate === "string" && candidate.trim()) detail = candidate.trim();
	} catch {
		// non-JSON error body — fall back to the status line
	}
	return new AgentGatewayError(detail ?? `agent gateway ${label} → ${response.status}`, response.status);
}
