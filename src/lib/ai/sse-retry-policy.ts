export function shouldRetryGenerationStream(input: {
    receivedAnyEvent: boolean
    retryCount: number
    maxRetries: number
}): boolean {
    return !input.receivedAnyEvent && input.retryCount < input.maxRetries
}
