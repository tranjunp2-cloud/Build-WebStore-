import type { ContextElement, ContextElementKind } from "@ech/agent-core";
import { Icon, type IconName } from "./icons";

const KIND_ICON: Record<ContextElementKind, IconName> = {
	text: "type",
	button: "mouse-pointer-click",
	image: "image",
	section: "layout-template",
	seo: "search",
	menu: "menu",
	footer: "panel-bottom",
	page: "file-text",
	product: "package",
	post: "file-text",
};

export const elementIcon = (kind: ContextElementKind): IconName => KIND_ICON[kind] ?? "sparkles";

export interface ElementChipProps {
	element: ContextElement;
	/** what the kind is called in the chip ("Button", "Picture") */
	kindLabel: string;
	onRemove?: () => void;
	removeLabel?: string;
	/** pointer over the chip: the host lights the element up on the page */
	onHover?: (element: ContextElement | null) => void;
}

/**
 * One thing on the page in the chat — the same chip in the composer, in the
 * sent message and in the editor's Ask AI box: kind icon, kind, what it says.
 */
export function ElementChip({ element, kindLabel, onRemove, removeLabel, onHover }: ElementChipProps) {
	return (
		<span
			className="ech-ag-el"
			title={element.value ? `${kindLabel}: ${element.value}` : `${kindLabel}: ${element.label}`}
			onPointerEnter={onHover ? () => onHover(element) : undefined}
			onPointerLeave={onHover ? () => onHover(null) : undefined}
		>
			<Icon name={elementIcon(element.kind)} size={13} />
			<b>{kindLabel}</b>
			<span>{element.label}</span>
			{onRemove && (
				<button type="button" aria-label={removeLabel} onClick={onRemove}>
					<Icon name="x" size={12} />
				</button>
			)}
		</span>
	);
}
