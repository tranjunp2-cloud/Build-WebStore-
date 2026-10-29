import type { NextRequest } from "next/server";
import type { AgentActor } from "../context";
import { isWorkLocale, type WorkLocale } from "./work-format";

/**
 * The merchant's language for the work queue, the way the dashboard (and its
 * agent dock) gets it: the `prefer_lang` cookie the UI keeps in sync, then the
 * profile's `prefer_lang`. A `?locale=` the client sends wins (vi when the
 * merchant writes to the assistant in Vietnamese); anything unknown → en.
 */
export function resolveWorkLocale(req: NextRequest, actor: Pick<AgentActor, "locale">): WorkLocale {
	const asked = new URL(req.url).searchParams.get("locale");
	if (isWorkLocale(asked)) return asked;
	const cookie = req.cookies.get("prefer_lang")?.value;
	if (isWorkLocale(cookie)) return cookie;
	if (isWorkLocale(actor.locale)) return actor.locale;
	return "en";
}
