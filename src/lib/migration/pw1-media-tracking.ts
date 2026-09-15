import { AsyncLocalStorage } from 'node:async_hooks'
// A store-level scope spans retries. Only actual new uploads are recorded, never cache hits.
const scope = new AsyncLocalStorage<Set<number>>()
export function withPw1MediaTracking<T>(created: Set<number>, operation: () => Promise<T>) {
    return scope.run(created, operation)
}
export function recordCreatedPw1Media(id: number) { scope.getStore()?.add(id) }
