import { isWorkflowInvocation, runWorkflow } from '../src/lib/migration/pw1-json/workflow'
import { argumentsForUsers, runUserImport } from '../src/lib/migration/pw1-json/user-runner'
import { safeError } from '../src/lib/migration/pw1-json/runner'

if (process.argv.includes('--help')) process.stdout.write('One command: npm run migrate:pw1:users -- --config /private/local.json (--all | --store ID | --stores ID,ID | --from-store ID --to-store ID) [--dry-run]\nRun recovery: --run /private/runs/RUN_ID --export-only\nDestination only: --run /private/runs/RUN_ID --export-only\n')

Promise.resolve()
  .then(() => !process.argv.includes('--help') && isWorkflowInvocation(process.argv.slice(2)) ? runWorkflow(process.argv.slice(2), 'users') : runUserImport(argumentsForUsers(process.argv.includes('--help') ? ['--help'] : process.argv.slice(2))))
  .catch((error: unknown) => {
    const result = safeError(error)
    process.stderr.write(JSON.stringify(result) + '\n')
    process.exitCode = result.exitCode
  })
