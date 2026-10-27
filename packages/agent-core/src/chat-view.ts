import type { AgentAttachment, AgentRun, ChangeSet, ContextElement, ReceiptMedia } from "./schemas";

/**
 * One chat turn as the assistant panel shows it. A user turn carries the
 * prompt (and files); an assistant turn carries the live AgentRun plus any
 * change sets it staged — the run IS the reply.
 */
export type AgentChatTurn =
	| {
			id: string;
			role: "user";
			text: string;
			attachments?: AgentAttachment[];
			/** pictures of this chat the merchant chose for the message ("Use this") */
			pictures?: ReceiptMedia[];
			/** things on the page sent with the message (Ask AI on an element) */
			elements?: ContextElement[];
	  }
	| { id: string; role: "assistant"; run: AgentRun | undefined; changeSets: ChangeSet[] };

/** A file in the composer tray: uploading, ready to send, or refused. */
export interface ComposerAttachment {
	/** local id until the upload lands */
	key: string;
	name: string;
	kind: AgentAttachment["kind"];
	status: "uploading" | "ready" | "error";
	/** 0..1 while uploading */
	progress: number;
	/** local preview (object URL) or the server's thumbnail */
	previewUrl?: string;
	attachment?: AgentAttachment;
	error?: string;
	/** a picture already in this chat, chosen with "Use this" (sent by id, not uploaded) */
	chosen?: ReceiptMedia;
}
