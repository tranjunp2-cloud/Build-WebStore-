/** Codes/messages are safe to log; never attach raw driver/input errors. */
export class MigrationError extends Error {
  readonly code: string
  constructor(code: string, message = code, _cause?: unknown) {
    super(message)
    this.name = 'MigrationError'
    this.code = code
  }
}
