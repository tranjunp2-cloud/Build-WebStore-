/**
 * The copilot's static prefix (system instructions + tool definitions) per capability set, unrouted and
 * for typical routed messages (AI_TOOL_ROUTING=on). Run: ../../node_modules/.bin/tsx scripts/measure-prompt.ts
 * (≈4 characters per token).
 */
import type { ToolSet } from "ai";
import { capabilitySet } from "../src/agent/merchant-capabilities";
import { merchantInstructions } from "../src/agent/merchant-instructions";
import { createMerchantTools } from "../src/agent/merchant-tools";
import { routeGroups, ToolRouter, USE_TOOLS, useToolsTool } from "../src/agent/tool-routing";
import { estimateTokens, NO_DEPS, prefixSize, STAGING_FULL, STAGING_SMALL, toolSizes } from "../src/cost/prompt-size";

const fmt = (n: number) => String(n).padStart(7);
const ctx = (module: string, request: string) => `Context: the merchant is on the "${module}" page, UI locale en-MY. Today is 2026-10-22.\n\n${request}`;
const SAMPLES: Array<[string, string]> = [
	["hi (dashboard)", ctx("dashboard", "hi")],
	["sales today (dashboard)", ctx("dashboard", "How were sales today?")],
	["blog post (blog page)", ctx("blog", "Write a post about caring for batik")],
	["hero text (editor)", ctx("editor", "Make the hero headline shorter")],
	["confirm orders (orders)", ctx("orders", "Confirm the pending orders")],
	["discount code (discounts)", ctx("discounts", "Create a 10% code for this weekend")],
	["product price (products)", ctx("products", "Change the price of the batik scarf to RM 59")],
	["reply to lead (contact-leads)", ctx("contact-leads", "Reply to the newest message")],
	["campaign (dashboard)", ctx("dashboard", "Run a 11.11 campaign with 15% off")],
];

for (const [label, caps] of [
	["small", STAGING_SMALL],
	["full", STAGING_FULL],
] as const) {
	const size = await prefixSize(caps);
	console.log(`\n== ${label}: ${caps.join(",")}`);
	console.log(`instructions ${fmt(size.instructionsChars)} chars  ≈${estimateTokens(size.instructionsChars)} tok`);
	for (const t of [...size.tools].sort((a, b) => b.chars - a.chars)) console.log(`  ${t.name.padEnd(30)} ${fmt(t.chars)}  ≈${estimateTokens(t.chars)}`);
	console.log(`tools        ${fmt(size.toolChars)} chars  ≈${estimateTokens(size.toolChars)} tok (${size.tools.length} tools)`);
	console.log(`TOTAL        ${fmt(size.totalChars)} chars  ≈${estimateTokens(size.totalChars)} tok`);

	const full = capabilitySet(caps);
	const all = { ...(createMerchantTools(NO_DEPS, full) as ToolSet) };
	console.log(`-- routed (AI_TOOL_ROUTING=on)`);
	for (const [name, turn] of SAMPLES) {
		const router = new ToolRouter(full, { groups: routeGroups({ turns: [turn] }) });
		const tools: ToolSet = router.complete ? all : { ...all, [USE_TOOLS]: useToolsTool(full, () => []) };
		const sent = [...router.sentTools(Object.keys(tools))];
		const instructions = router.complete ? merchantInstructions(full) : merchantInstructions(router.capabilities, full);
		const toolChars = (await toolSizes(tools, sent)).reduce((sum, t) => sum + t.chars, 0);
		const total = instructions.length + toolChars;
		console.log(
			`  ${name.padEnd(30)} [${router.groups.join("+") || "core"}] instr ${fmt(instructions.length)} + tools ${fmt(toolChars)} (${sent.length}) = ${fmt(total)} chars ≈${estimateTokens(total)} tok (${Math.round((100 * total) / size.totalChars)}%)`,
		);
	}
}
