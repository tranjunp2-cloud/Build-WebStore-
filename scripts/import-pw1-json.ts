import { argumentsFor, runImport, safeError } from '../src/lib/migration/pw1-json/runner'

Promise.resolve().then(() => runImport(argumentsFor(process.argv.slice(2)))).catch((error: unknown) => {
  const result = safeError(error)
  process.stderr.write(JSON.stringify(result) + '\n')
  process.exitCode = result.exitCode
})
