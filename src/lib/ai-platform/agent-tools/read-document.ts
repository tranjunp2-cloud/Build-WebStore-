import "server-only";

import { inflateRawSync } from "node:zlib";

/**
 * Text out of a document the merchant attached — the assistant only reads it
 * for facts (size charts, supplier specs). PDF via pdf.js, CSV as is, XLSX by
 * reading its shared strings + sheet cells (no extra dependency).
 */

export const DOCUMENT_TEXT_LIMIT = 200_000;

/** Time one PDF may take to read: a crafted file can keep pdf.js busy for minutes on a few pages. */
export const PDF_TIME_BUDGET_MS = 10_000;
export const PDF_PAGES_MAX = 50;

export class DocumentReadTimeoutError extends Error {
	constructor() {
		super("The document took too long to read.");
		this.name = "DocumentReadTimeoutError";
	}
}

/** Lets timers (the budget) and other requests run: pdf.js in-process parses on microtasks only, never yielding. */
const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

async function pdfText(buffer: Buffer, budgetMs = PDF_TIME_BUDGET_MS): Promise<string> {
	const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
	// pdf.js parses in a "fake worker" it loads by file path next to itself; in the bundled server that file is
	// not there ("Setting up fake worker failed"). It looks at globalThis.pdfjsWorker first, so the worker module
	// is handed over here. This is why pdfjs-dist can stay a bundled (not external) package: the orders label
	// preview needs it that way. Verified in a production `next build` + `next start`.
	const scope = globalThis as { pdfjsWorker?: unknown };
	if (!scope.pdfjsWorker) scope.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
	const deadline = Date.now() + budgetMs;
	const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false });
	let timedOut = false;
	const read = async () => {
		const doc = await task.promise;
		const pages: string[] = [];
		let length = 0;
		for (let i = 1; i <= Math.min(doc.numPages, PDF_PAGES_MAX) && length < DOCUMENT_TEXT_LIMIT; i += 1) {
			// between pages: give the event loop a turn and stop once the budget is spent
			await yieldToEventLoop();
			if (timedOut || Date.now() > deadline) throw new DocumentReadTimeoutError();
			const page = await doc.getPage(i);
			const content = await page.getTextContent();
			const text = content.items
				.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
				.join("")
				.replace(/[ \t]+/g, " ")
				.trim();
			pages.push(text);
			length += text.length;
		}
		return pages.join("\n\n");
	};
	let timer: ReturnType<typeof setTimeout> | undefined;
	const budget = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			timedOut = true;
			reject(new DocumentReadTimeoutError());
		}, budgetMs);
	});
	try {
		// the timer covers a step that waits (loading), the page loop covers a parse that keeps the CPU busy
		return await Promise.race([read(), budget]);
	} finally {
		clearTimeout(timer);
		// stops the parse still running after a timeout and frees the document either way (destroys `doc` too)
		await task.destroy().catch(() => undefined);
	}
}

/**
 * Inflated bytes one XLSX may produce (all read entries together). A zip bomb (a few KB inflating to GBs, or
 * many entries pointing at the same data) would otherwise take the whole function's memory and CPU.
 */
export const XLSX_INFLATED_LIMIT = 32 * 1024 * 1024;
const XLSX_READ_ENTRIES_MAX = 40;

/** Minimal ZIP reader: central directory → stored / deflated entries. */
function unzip(buffer: Buffer): Map<string, Buffer> {
	const files = new Map<string, Buffer>();
	const seen = new Set<number>();
	let inflated = 0;
	let eocd = -1;
	for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i -= 1) {
		if (buffer.readUInt32LE(i) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error("Not a valid XLSX file.");
	const count = buffer.readUInt16LE(eocd + 10);
	let offset = buffer.readUInt32LE(eocd + 16);
	for (let n = 0; n < count && offset + 46 <= buffer.length; n += 1) {
		if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
		const method = buffer.readUInt16LE(offset + 10);
		const compressed = buffer.readUInt32LE(offset + 20);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const local = buffer.readUInt32LE(offset + 42);
		const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
		const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
		const data = buffer.subarray(dataStart, dataStart + compressed);
		if (/^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(name)) {
			if (seen.has(local) || seen.size >= XLSX_READ_ENTRIES_MAX) throw new Error("Not a valid XLSX file.");
			seen.add(local);
			const remaining = XLSX_INFLATED_LIMIT - inflated;
			if (method === 8) {
				let file: Buffer;
				try {
					file = inflateRawSync(data, { maxOutputLength: Math.max(1, remaining) });
				} catch {
					throw new Error("The spreadsheet is too large to read.");
				}
				inflated += file.length;
				files.set(name, file);
			} else {
				inflated += data.length;
				if (inflated > XLSX_INFLATED_LIMIT) throw new Error("The spreadsheet is too large to read.");
				files.set(name, Buffer.from(data));
			}
		}
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return files;
}

function decodeXml(text: string): string {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&amp;/g, "&");
}

function xlsxText(buffer: Buffer): string {
	const files = unzip(buffer);
	const shared = [...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
		decodeXml([...(m[1] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1] ?? "").join("")),
	);
	const sheets = [...files.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort();
	const out: string[] = [];
	let length = 0;
	for (const sheet of sheets.slice(0, 5)) {
		const xml = files.get(sheet)?.toString("utf8") ?? "";
		for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
			const cells = [...(row[1] ?? "").matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map((cell) => {
				const attrs = cell[1] ?? "";
				const inner = cell[2] ?? "";
				const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
				return /t="s"/.test(attrs) ? (shared[Number(value)] ?? "") : decodeXml(value);
			});
			if (cells.some((c) => c.trim())) {
				const line = cells.join("\t");
				out.push(line);
				length += line.length + 1;
			}
			if (length > DOCUMENT_TEXT_LIMIT) break;
		}
		out.push("");
	}
	return out.join("\n");
}

export async function readDocumentText(buffer: Buffer, mime: string, options: { pdfBudgetMs?: number } = {}): Promise<string> {
	let text = "";
	if (mime === "application/pdf") text = await pdfText(buffer, options.pdfBudgetMs);
	else if (mime === "text/csv") text = buffer.toString("utf8");
	else if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") text = xlsxText(buffer);
	return text.replace(/\u0000/g, "").slice(0, DOCUMENT_TEXT_LIMIT);
}
