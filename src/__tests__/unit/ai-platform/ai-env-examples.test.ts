/**
 * TC-AIREL-217 — the staging and production env examples document the copilot abilities this release turns on
 * (`AI_AGENT_CAPABILITIES`, set in the AI platform project) next to the other AI platform variables, as a comment
 * (this app does not read it, so it must not be an active variable).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const VALUE = 'site,blog,stock_photos,media_library,image_generation,shop_products,store_categories,store_discounts,store_customers,campaigns,store_orders,store_reports'

describe('env examples name the copilot abilities [TC-AIREL-217]', () => {
    it.each(['.env.staging.example', '.env.production.example'])('%s', (file) => {
        const lines = readFileSync(join(process.cwd(), file), 'utf8').split('\n')

        expect(lines).toContain(`#   AI_AGENT_CAPABILITIES=${VALUE}`)
        // documented beside the other AI platform variables, and never an active assignment in this app's env
        const documented = lines.findIndex((line) => line.includes('AI_AGENT_CAPABILITIES='))
        expect(lines.findIndex((line) => line.startsWith('AI_AGENT_ENABLED='))).toBeLessThan(documented)
        expect(lines.some((line) => line.startsWith('AI_AGENT_CAPABILITIES='))).toBe(false)
    })
})

describe('env examples set the copilot switch per environment [TC-AICP-341]', () => {
    const activeValue = (file: string) =>
        readFileSync(join(process.cwd(), file), 'utf8')
            .split('\n')
            .find((line) => line.startsWith('AI_AGENT_ENABLED='))
            ?.slice('AI_AGENT_ENABLED='.length)

    it('[TC-AICP-341] staging turns it on, production keeps it off, local dev leaves it unset (on)', () => {
        // Arrange + Act
        const staging = activeValue('.env.staging.example')
        const production = activeValue('.env.production.example')
        const local = activeValue('.env.example')

        // Assert
        expect(staging).toBe('true')
        expect(production).toBe('false')
        expect(local).toBeUndefined()
    })
})
