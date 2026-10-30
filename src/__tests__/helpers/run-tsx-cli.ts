import { execFile } from 'node:child_process'

/**
 * Per-subprocess cap for CLI tests. On shared CI runners a tsx cold start plus fsync under
 * disk contention can take tens of seconds; tests using this must set a test timeout that
 * covers all of their sequential runs.
 */
export const CLI_SUBPROCESS_TIMEOUT_MS = 60_000

export interface CliResult {
  code: number
  stdout: string
  stderr: string
}

/**
 * Runs `node --import tsx <script> ...args` and resolves with its exit code and output.
 * A subprocess killed by the timeout rejects with signal and stderr, so a kill is never
 * mistaken for exit code 0 (`Number(null) === 0`).
 */
export function runTsxCli(
  script: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', script, ...args],
      { timeout: CLI_SUBPROCESS_TIMEOUT_MS, env: env ?? process.env },
      (error, stdout, stderr) => {
        if (error?.killed || error?.signal) {
          reject(
            new Error(
              `${script} killed by ${error.signal ?? 'signal'} (timeout ${CLI_SUBPROCESS_TIMEOUT_MS}ms); stderr:\n${stderr}`,
            ),
          )
          return
        }
        resolve({ code: error ? Number(error.code) : 0, stdout, stderr })
      },
    )
  })
}
