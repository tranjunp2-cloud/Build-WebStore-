// Reads the dotenv file `vercel pull` writes (.vercel/.env.<target>.local) WITHOUT sourcing it in a
// shell: a value holding `$`, a backtick or `$(…)` stays plain text. Callers never print values.
// Node builtins only — CI deploy jobs run this before any `npm ci`.
import fs from 'node:fs'

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/

function unquote(raw) {
	const value = raw.trim()
	const quote = value[0]
	if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
		const inner = value.slice(1, -1)
		// vercel pull writes KEY="value" with newlines escaped as \n (dotenv convention)
		return quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : inner
	}
	// Unquoted: an inline comment starts at " #"
	const comment = value.search(/\s#/)
	return (comment === -1 ? value : value.slice(0, comment)).trim()
}

/** dotenv text → Map(key → value). Comments / blank lines skipped; a repeated key: last one wins. */
export function parseEnvFile(text) {
	const vars = new Map()
	for (const line of text.split(/\r?\n/)) {
		if (!line.trim() || line.trim().startsWith('#')) continue
		const match = LINE.exec(line)
		if (match) vars.set(match[1], unquote(match[2]))
	}
	return vars
}

/** Map of the file's vars, or null when the file does not exist. */
export function readEnvFile(path) {
	if (!fs.existsSync(path)) return null
	return parseEnvFile(fs.readFileSync(path, 'utf8'))
}
