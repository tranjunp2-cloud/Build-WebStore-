import type { ConversationMessage } from "@ech/agent-core";
import type { ReactNode } from "react";
import { AgentOrb, PolicyPill } from "./primitives";

export interface MessageBubbleProps {
	message: ConversationMessage;
	/** actions rendered inside a draft bubble (approve & send / edit / take over) */
	draftActions?: ReactNode;
}

/**
 * Message bubble. Agent replies carry provenance + policy status; drafts are
 * visually fenced (dashed) until a human sends them.
 */
export function MessageBubble({ message, draftActions }: MessageBubbleProps) {
	if (message.author === "system") return <div className="ech-ag-sys">{message.body}</div>;
	const isAgent = message.author === "agent";
	return (
		<div className={`ech-ag-bubble ${isAgent ? "agent" : "customer"}${message.draft ? " draft" : ""}`}>
			{isAgent && (
				<div className="ech-ag-bubble-head">
					<AgentOrb size={12} />
					{message.draft ? "ECH Agent · draft — needs your send" : "ECH Agent"}
				</div>
			)}
			{message.body}
			<div className="meta">
				{message.sources.map((s) => (
					<span key={s} className="src">
						src: {s}
					</span>
				))}
				{message.policy && <PolicyPill status={message.policy.status} note={message.policy.note} />}
				<span style={{ marginLeft: "auto" }}>
					{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
				</span>
			</div>
			{message.draft && draftActions && <div style={{ display: "flex", gap: 6, marginTop: 9 }}>{draftActions}</div>}
		</div>
	);
}

export function ConversationThread({
	messages,
	draftActions,
}: {
	messages: ConversationMessage[];
	draftActions?: ReactNode;
}) {
	return (
		<div className="ech-ag-thread">
			{messages.map((m) => (
				<MessageBubble key={m.id} message={m} draftActions={m.draft ? draftActions : undefined} />
			))}
		</div>
	);
}
