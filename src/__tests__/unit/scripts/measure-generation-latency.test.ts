import { describe, expect, it } from 'vitest'
import { assertBenchmarkSuccessful } from '../../../../scripts/measure-generation-latency'

describe('generation latency benchmark result', () => {
    it('fails the command when any measured generation failed', () => {
        expect(() => assertBenchmarkSuccessful({ attempts: 5, failures: 1 }))
            .toThrow('benchmark completed with 1/5 failed run(s)')
    })

    it('allows an all-green benchmark result', () => {
        expect(() => assertBenchmarkSuccessful({ attempts: 5, failures: 0 })).not.toThrow()
    })
})
