import { describe, it, expect } from 'vitest'
import {
    deriveGenerationStage,
    EMPTY_STAGE_MEMORY,
    type GenerationStageInput,
    type GenerationStageMemory,
} from '@/components/builder/builder-generation-stage'

/** Feed a sequence of ticks through the stage mapper, carrying memory like the hook does. */
function run(ticks: GenerationStageInput[]) {
    let memory: GenerationStageMemory = EMPTY_STAGE_MEMORY
    return ticks.map((tick) => {
        const result = deriveGenerationStage(tick, memory)
        memory = result.memory
        return result.stage
    })
}

const tick = (elapsedSeconds: number, progress: number, hasTheme = false, blockCount = 0): GenerationStageInput => ({
    elapsedSeconds, progress, hasTheme, blockCount,
})

// ── TC-F01.08 / TC-F01.109: generating panel stages follow the real SSE signals ──
describe('[TC-F01.08] deriveGenerationStage', () => {
    it('TC-F01.08: reads the brief row by row on the elapsed ticker (stage 1)', () => {
        // Arrange + Act
        const [s0, s2, s4] = run([tick(0, 10), tick(2, 20), tick(4, 20)])

        // Assert
        expect(s0).toMatchObject({ phase: 0, briefRead: 0, caption: 'reading' })
        expect(s2).toMatchObject({ phase: 0, briefRead: 2, caption: 'reading' })
        expect(s4).toMatchObject({ phase: 0, briefRead: 4, caption: 'style' })
    })

    it('TC-F01.08: stays on the brief while the server has not reached the generating step', () => {
        // Arrange + Act — progress stuck at 10 (analyzing) even after 8s
        const [stage] = run([tick(8, 10)])

        // Assert
        expect(stage.phase).toBe(0)
    })

    it('TC-F01.109: lays out the wireframe, then writes content, but never paints without theme_set', () => {
        // Arrange + Act
        const stages = run([tick(5, 20), tick(7, 20), tick(11, 20), tick(40, 20)])

        // Assert
        expect(stages[0]).toMatchObject({ phase: 1, sectionsShown: 1, caption: 'planning' })
        expect(stages[1]).toMatchObject({ phase: 1, sectionsShown: 3, currentSection: 2 })
        expect(stages[2]).toMatchObject({ phase: 1, content: true, typing: true, caption: 'writing' })
        expect(stages[3]).toMatchObject({ phase: 1, content: true, typing: false, painted: false, caption: 'writing' })
    })

    it('TC-F01.09: paints with the real theme, then shows the streamed preview once blocks arrive', () => {
        // Arrange + Act
        const stages = run([
            tick(5, 20), tick(11, 20),
            tick(30, 60, true), // theme_set
            tick(31, 62, true), // held painted, no blocks yet
            tick(32, 64, true, 2), // blocks streaming
            tick(33, 70, true, 4),
        ])

        // Assert
        expect(stages[2]).toMatchObject({ phase: 1, painted: true, caption: 'applying' })
        expect(stages[3].phase).toBe(1)
        expect(stages[4]).toMatchObject({ phase: 2, phoneShown: false, caption: 'assembling' })
        expect(stages[5]).toMatchObject({ phase: 2, phoneShown: true, caption: 'mobile' })
    })

    it('TC-F01.109: "Preview ready" only after the saving step (no fake completion)', () => {
        // Arrange + Act
        const stages = run([tick(5, 20), tick(11, 20), tick(20, 60, true), tick(23, 80, true, 3), tick(26, 92, true, 9), tick(28, 95, true, 12)])

        // Assert
        expect(stages[3].ready).toBe(false)
        expect(stages[4]).toMatchObject({ ready: false, caption: 'finishing' })
        expect(stages[5]).toMatchObject({ ready: true, caption: 'opening' })
    })

    it('TC-F01.08: stepper connectors fill monotonically across stages', () => {
        // Arrange + Act
        const fills = run([tick(1, 20), tick(5, 20), tick(11, 20), tick(20, 60, true), tick(23, 70, true, 2)]).map((s) => s.connectorFill)

        // Assert
        expect(fills[0][0]).toBeGreaterThan(0)
        expect(fills[1]).toEqual([100, expect.any(Number)])
        expect(fills[2][1]).toBeGreaterThan(fills[1][1])
        expect(fills[3][1]).toBeGreaterThan(fills[2][1])
        expect(fills[4]).toEqual([100, 100])
    })
})
