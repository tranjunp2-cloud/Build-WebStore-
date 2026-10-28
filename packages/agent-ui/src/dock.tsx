import type { ContextPin } from "@ech/agent-core";
import { type FormEvent, type ReactNode, useState } from "react";
import { AgentOrb } from "./primitives";

export interface ComposerProps {
	placeholder?: string;
	hint?: string;
	disabled?: boolean;
	onSubmit?: (text: string) => void;
}

export function Composer({ placeholder = "Ask or instruct the agent…", hint, disabled, onSubmit }: ComposerProps) {
	const [value, setValue] = useState("");
	const submit = (e?: FormEvent) => {
		e?.preventDefault();
		const text = value.trim();
		if (!text || disabled) return;
		onSubmit?.(text);
		setValue("");
	};
	return (
		<form className="ech-ag-composer" onSubmit={submit}>
			<textarea
				value={value}
				disabled={disabled}
				placeholder={placeholder}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
				}}
			/>
			<div className="ech-ag-composer-foot">
				{hint && <span className="ech-ag-composer-hint">{hint}</span>}
				<button type="submit" className="ech-ag-send" aria-label="Send" disabled={disabled}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
						<title>Send</title>
						<path d="M12 19V5M5 12l7-7 7 7" />
					</svg>
				</button>
			</div>
		</form>
	);
}

export interface AgentDockProps {
	pin?: ContextPin;
	title?: string;
	children: ReactNode;
	composerPlaceholder?: string;
	composerHint?: string;
	onSubmit?: (text: string) => void;
	headerExtra?: ReactNode;
}

/**
 * AgentDock — the persistent right-rail surface, context-pinned to whatever
 * the merchant is looking at. Not a floating chatbot: the agent sees what
 * you see.
 */
export function AgentDock({
	pin,
	title = "ECH Agent",
	children,
	composerPlaceholder,
	composerHint,
	onSubmit,
	headerExtra,
}: AgentDockProps) {
	return (
		<aside className="ech-ag ech-ag-dock">
			<div className="ech-ag-dock-head">
				<AgentOrb size={16} />
				<span className="t">{title}</span>
				{headerExtra}
				{pin && (
					<span className="ech-ag-dock-pin" title={pin.entity ? `${pin.entity.kind}:${pin.entity.id}` : pin.module}>
						◉ {pin.entity?.label ?? pin.module}
					</span>
				)}
			</div>
			<div className="ech-ag-dock-body">{children}</div>
			<div className="ech-ag-dock-foot">
				<Composer placeholder={composerPlaceholder} hint={composerHint} onSubmit={onSubmit} />
			</div>
		</aside>
	);
}
