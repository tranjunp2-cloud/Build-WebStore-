export function shouldRetryGenerationStream(input: {
    requestSubmitted: boolean
}): boolean {
    // Once POST may have reached the server, another POST with the same inputs
    // can race the accepted generation. Recovery must use status polling or an
    // explicit user action, never an automatic re-submit.
    return !input.requestSubmitted
}
