#!/usr/bin/env node
// CI preflight: is the Postgres in <KEY> of a `vercel pull` env file reachable from the runner?
// Runs before `vercel build` applies migrations, so a missing / unreachable DB fails here, not mid-build.
//
//   node scripts/ci/pg-tcp-check.mjs <env-file> <KEY> [--forbid <substring> [--forbid-hint <text>]]
//
// Reads only <KEY> (the file is never sourced) and never prints the value — only host:port.
// --forbid: fail when the value contains <substring> (qc-test must not point at the staging endpoint).
import net from 'node:net'
import { pathToFileURL } from 'node:url'
import { readEnvFile } from './env-file.mjs'

/** TCP-level probe (no npm install, no credentials sent). Resolves { ok, message }. */
export function probeTcp(host, port, timeoutMs = 5000) {
	return new Promise((resolve) => {
		const where = `${host}:${port}`
		const socket = net.createConnection({ host, port })
		const done = (result) => {
			socket.destroy()
			resolve(result)
		}
		socket.setTimeout(timeoutMs)
		socket.on('connect', () => done({ ok: true, message: `pg tcp ok (${where})` }))
		socket.on('timeout', () => done({ ok: false, message: `pg tcp timeout (${where})` }))
		socket.on('error', (e) => done({ ok: false, message: `pg tcp err (${where}): ${e.message}` }))
	})
}

function parseArgs(argv) {
	const [file, key, ...rest] = argv
	const opts = { file, key, forbid: null, forbidHint: null }
	for (let i = 0; i < rest.length; i += 2) {
		if (rest[i] === '--forbid') opts.forbid = rest[i + 1]
		else if (rest[i] === '--forbid-hint') opts.forbidHint = rest[i + 1]
		else throw new Error(`unknown argument ${rest[i]}`)
	}
	if (!file || !key) throw new Error('usage: pg-tcp-check.mjs <env-file> <KEY> [--forbid <substring> [--forbid-hint <text>]]')
	return opts
}

/** Returns the process exit code. `log` = { log } (console in CI; annotations go to stdout). */
export async function main(argv, log = console, timeoutMs = 5000) {
	let opts
	try {
		opts = parseArgs(argv)
	} catch (e) {
		log.log(`::error::${e.message}`)
		return 1
	}
	const vars = readEnvFile(opts.file)
	if (!vars) {
		log.log(`::error::vercel pull did not produce ${opts.file}`)
		return 1
	}
	const value = vars.get(opts.key)?.trim()
	if (!value) {
		log.log(`::error::${opts.key} not present in ${opts.file}`)
		return 1
	}
	if (opts.forbid && value.includes(opts.forbid)) {
		log.log(`::error::${opts.key} matches the forbidden endpoint "${opts.forbid}"`)
		if (opts.forbidHint) log.log(`::error::${opts.forbidHint}`)
		return 1
	}
	let url
	try {
		url = new URL(value)
	} catch {
		// new URL's own error echoes the input (credentials) — say only which key is wrong
		log.log(`::error::${opts.key} is not a valid URL`)
		return 1
	}
	const result = await probeTcp(url.hostname, Number(url.port || 5432), timeoutMs)
	if (result.ok) {
		log.log(result.message)
		return 0
	}
	log.log(`::error::${result.message}`)
	return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main(process.argv.slice(2)).then((code) => process.exit(code))
}
