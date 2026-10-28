import { Fragment, type ReactNode } from "react";

/**
 * The assistant's reply as text: paragraphs, "- " / "1. " lists, **bold** and
 * `code`. Everything becomes React text nodes — no HTML, no links — so a reply
 * can never inject markup into the dashboard.
 */
export function AnswerText({ text }: { text: string }) {
	return <>{blocks(text).map((block, i) => renderBlock(block, i))}</>;
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

function blocks(text: string): Block[] {
	const out: Block[] = [];
	for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
		const line = raw.trimEnd();
		const last = out.at(-1);
		const kind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : null;
		if (!line.trim()) {
			if (last) out.push({ kind: "p", lines: [] });
		} else if (kind) {
			const item = line.replace(kind === "ul" ? BULLET : NUMBERED, "");
			if (last?.kind === kind) last.items.push(item);
			else out.push({ kind, items: [item] });
		} else if (last?.kind === "p") {
			last.lines.push(line.replace(/^#{1,4}\s+/, ""));
		} else {
			out.push({ kind: "p", lines: [line.replace(/^#{1,4}\s+/, "")] });
		}
	}
	return out.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

function renderBlock(block: Block, key: number): ReactNode {
	if (block.kind === "p") {
		return (
			<p key={key}>
				{block.lines.map((line, i) => (
					<Fragment key={i}>
						{i > 0 && "\n"}
						{inline(line)}
					</Fragment>
				))}
			</p>
		);
	}
	const List = block.kind;
	return (
		<List key={key} className="ech-ag-list">
			{block.items.map((item, i) => (
				<li key={i}>{inline(item)}</li>
			))}
		</List>
	);
}

/** **bold** and `code`; any other markdown stays as typed. */
function inline(text: string): ReactNode[] {
	return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
		if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
		if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
		return part;
	});
}
