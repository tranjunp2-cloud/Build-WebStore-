import { argumentsForUsers, runUserImport } from '../src/lib/migration/pw1-json/user-runner'
import { safeError } from '../src/lib/migration/pw1-json/runner'

Promise.resolve()
  .then(() => runUserImport(argumentsForUsers(process.argv.slice(2))))
  .catch((error: unknown) => {
    const result = safeError(error)
    process.stderr.write(JSON.stringify(result) + '\n')
    process.exitCode = result.exitCode
  })
