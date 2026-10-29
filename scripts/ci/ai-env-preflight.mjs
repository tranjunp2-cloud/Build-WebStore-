#!/usr/bin/env node
// CI preflight: does the pulled prime-web env reach the AI platform? Without AI_PLATFORM_URL and a
// valid AI_PLATFORM_CONTEXT_SECRET the site still runs, but onboarding falls back to rule-based sites,
// auto SEO stops and /api/ai/* answers 503 — with nobody told (src/lib/ai-platform/config.ts).
//
//   node scripts/ci/ai-env-preflight.mjs <env-file> [--warn-only]
//
// Problems → ::error:: + exit 1, unless --warn-only (staging) or env ALLOW_PROD_WITHOUT_AI=true
// (repo variable, a deliberate "ship production without AI") → ::warning:: + exit 0.
// AI_AGENT_ENABLED is not checked: the copilot is off on production on purpose.
// Reads only the two keys (the file is never sourced) and never prints a value.
import { pathToFileURL } from 'node:url'
import { readEnvFile } from './env-file.mjs'

const MIN_SECRET_LENGTH = 32 // getAiPlatformContextSecret(): shorter = treated as unset

/** vars: Map from parseEnvFile. Returns { problems, notes } — problems block, notes only warn. */
export function checkAiPlatformEnv(vars) {
	const problems = []
	const notes = []

	const url = vars.get('AI_PLATFORM_URL')?.trim()
	if (!url) {
		problems.push('AI_PLATFORM_URL is missing or empty')
	} else {
		let protocol = null
		try {
			protocol = new URL(url).protocol
		} catch {
			/* reported below */
		}
		if (protocol !== 'https:') problems.push('AI_PLATFORM_URL must be an https:// URL')
	}

	if (!vars.has('AI_PLATFORM_CONTEXT_SECRET')) {
		problems.push('AI_PLATFORM_CONTEXT_SECRET is missing')
	} else {
		const secret = vars.get('AI_PLATFORM_CONTEXT_SECRET').trim()
		if (!secret) {
			// A Vercel "Sensitive" variable is pulled as an empty string, so the CLI cannot tell.
			notes.push(
				'AI_PLATFORM_CONTEXT_SECRET is empty in the pulled env (normal for a Sensitive variable) — make sure the Vercel value is set and 32+ characters',
			)
		} else if (secret.length < MIN_SECRET_LENGTH) {
			problems.push(`AI_PLATFORM_CONTEXT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters — the app treats it as unset`)
		}
	}

	return { problems, notes }
}

/** Returns the process exit code. `log` = { log } (console in CI; annotations go to stdout). */
export function main(argv, env = process.env, log = console) {
	const file = argv.find((a) => !a.startsWith('--'))
	const warnOnly = argv.includes('--warn-only')
	const allowWithoutAi = env.ALLOW_PROD_WITHOUT_AI === 'true'
	const soft = warnOnly || allowWithoutAi
	if (!file) {
		log.log('::error::usage: ai-env-preflight.mjs <env-file> [--warn-only]')
		return 1
	}

	const vars = readEnvFile(file)
	const { problems, notes } = vars
		? checkAiPlatformEnv(vars)
		: { problems: [`vercel pull did not produce ${file}`], notes: [] }

	for (const note of notes) log.log(`::warning::${note}`)
	if (problems.length === 0) {
		log.log(`AI platform env ok (${file})`)
		return 0
	}
	const level = soft ? 'warning' : 'error'
	for (const problem of problems) log.log(`::${level}::${problem}`)
	if (warnOnly) {
		log.log('AI features stay off on this deploy until the Vercel env is fixed.')
		return 0
	}
	if (allowWithoutAi) {
		log.log('ALLOW_PROD_WITHOUT_AI=true — deploying without AI (onboarding rule-based, auto SEO off, /api/ai/* 503).')
		return 0
	}
	log.log(
		'::error::Add the AI platform vars to the Vercel project (Production), or set repo variable ALLOW_PROD_WITHOUT_AI=true to deploy without AI.',
	)
	return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exit(main(process.argv.slice(2)))
}
