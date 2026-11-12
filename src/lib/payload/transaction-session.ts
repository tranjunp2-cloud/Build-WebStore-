/**
 * Registers a Drizzle callback transaction as a Payload session so Local API calls join it via
 * `req.transactionID`.
 *
 * When a Payload operation on that req fails, Payload's killTransaction drops the session, calls its
 * `reject`, then deletes `req.transactionID` from the req object the whole callback shares. Before,
 * nothing noticed: later calls on the same req (after a caught error) silently ran on other pool
 * connections, outside the lock — their writes survived the rollback, or waited forever on rows this
 * transaction locks (Postgres cannot see that wait). Now:
 *   - the req keeps its transactionID and the session is replaced by one whose every query throws
 *     TransactionAbortedError, so later calls fail fast instead of escaping the transaction;
 *   - `assertActive()` throws after the operation, so a callback that caught the error still rolls back.
 */
export class TransactionAbortedError extends Error {
    constructor() {
        super('A database operation failed inside the transaction; it was rolled back')
        this.name = 'TransactionAbortedError'
    }
}

type SessionRegistry = { sessions: Record<string, unknown> }

const abortedDb: unknown = new Proxy({}, {
    get() {
        throw new TransactionAbortedError()
    },
})

export function registerTransactionSession(db: SessionRegistry, transaction: unknown) {
    const transactionID = crypto.randomUUID()
    let aborted = false
    const session = {
        db: transaction,
        reject: async () => {
            aborted = true
            db.sessions[transactionID] = { ...session, db: abortedDb }
        },
        // the Drizzle callback commits; Payload never owns this transaction
        resolve: async () => {},
    }
    db.sessions[transactionID] = session
    // Payload deletes req.transactionID on failure; keep it so later calls hit the aborted session.
    const req = new Proxy({ transactionID } as { transactionID: string }, {
        deleteProperty: (target, key) => key === 'transactionID' || Reflect.deleteProperty(target, key),
    })
    return {
        transactionID,
        req,
        /** Throw when Payload aborted the session during the operation. */
        assertActive(): void {
            if (aborted || !db.sessions[transactionID]) throw new TransactionAbortedError()
        },
        release(): void {
            delete db.sessions[transactionID]
        },
    }
}
