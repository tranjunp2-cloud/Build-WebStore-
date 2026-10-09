import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { open, rename, rm, realpath } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { validateOutputPath } from './destination-master'
import { MigrationError } from './errors'

/** Linux local runner: kernel releases flock when the helper exits, including abrupt parent death. */
export async function lockWorkflow(directory: string): Promise<() => Promise<void>> {
  if (await realpath(directory) !== resolve(directory)) throw new MigrationError('WORKFLOW_DIRECTORY_UNSAFE')
  await validateOutputPath(resolve(directory, `.path-check-${randomUUID()}`))
  const child = spawn('flock', ['--nonblock', '--conflict-exit-code', '73', resolve(directory, '.lock'), process.execPath, '-e', 'process.stdout.write("LOCKED\\n");process.stdin.resume();process.stdin.on("end",()=>process.exit(0));'], { stdio: ['pipe', 'pipe', 'pipe'] })
  const closed = new Promise<void>(resolveClose => child.once('close', () => resolveClose()))
  try {
    await new Promise<void>((accept, reject) => {
      let output = ''
      child.once('error', () => reject(new MigrationError('WORKFLOW_LOCK_UNAVAILABLE')))
      child.once('exit', code => reject(new MigrationError(code === 73 ? 'WORKFLOW_LOCKED' : 'WORKFLOW_LOCK_UNAVAILABLE')))
      child.stdout.on('data', chunk => {
        output += String(chunk)
        if (output === 'LOCKED\n') accept()
        else if (!'LOCKED\n'.startsWith(output)) reject(new MigrationError('WORKFLOW_LOCK_UNAVAILABLE'))
      })
    })
  } catch (error) {
    child.stdin.destroy()
    child.kill()
    await closed
    throw error
  }
  return async () => { child.stdin.end(); await closed }
}
export async function writeWorkflowState(filename: string, value: unknown): Promise<void> {
  const temporary = resolve(dirname(filename), `.state-${randomUUID()}.tmp`)
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n')
    await handle.sync()
    await handle.close()
    await rename(temporary, filename)
    const directory = await open(dirname(filename), 'r')
    try { await directory.sync() } finally { await directory.close() }
  } finally { await handle.close(); await rm(temporary, { force: true }) }
}
