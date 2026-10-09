/** At most one renewal, no unhandled rejection, and no renewal after release. */
export function leaseHeartbeat(renew: () => Promise<void>, interval = 30_000, retryable: (error: unknown) => boolean = () => false) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let flight: Promise<void> | undefined
  let failure: unknown
  let stopped = false
  let lastSuccess = Date.now()
  let delay = interval
  const schedule = () => {
    if (stopped || failure) return
    timer = setTimeout(() => {
      flight = renew().then(() => { lastSuccess = Date.now(); delay = interval }).catch(error => {
        // Our transaction may hold the fenced row. Retry contention only while
        // comfortably inside the 300s lease; actual fencing loss is never ignored.
        if (retryable(error) && Date.now() - lastSuccess < 240_000) delay = 1000
        else failure = error
      }).finally(schedule)
    }, delay)
    timer.unref()
  }
  schedule()
  return {
    check: () => { if (failure) throw failure },
    stop: async () => { stopped = true; clearTimeout(timer); await flight },
  }
}
