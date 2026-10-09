// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { progressLogger } from '@/lib/migration/pw1-json/progress'

describe('[TC-F42-IMP-PROGRESS] terminal progress', () => {
  it('throttles byte updates, reports latest bytes and emits elapsed waiting heartbeat', () => {
    // Arrange
    let time = 0
    const lines: string[] = []
    const logger = progressLogger(line => lines.push(line), () => time)
    // Act
    logger.report({ phase: 'read-artifact', file: 'master.json', bytes: 0, totalBytes: 2097152 })
    time = 100
    logger.report({ phase: 'read-artifact', file: 'master.json', bytes: 1048576, totalBytes: 2097152 })
    logger.heartbeat()
    // Assert
    expect(lines).toHaveLength(1)
    time = 5000
    logger.heartbeat()
    expect(lines[1]).toContain('+5.0s')
    expect(lines[1]).toContain('MB=1.0/2.0 running')
    logger.heartbeat()
    expect(lines).toHaveLength(2)
  })
  it('immediately reports phase/store changes and completion without terminal escape codes', () => {
    // Arrange
    const lines: string[] = []
    const logger = progressLogger(line => lines.push(line), () => 0)
    // Act
    logger.report({ phase: 'preflight', storeId: '100', completed: 0, total: 2 })
    logger.report({ phase: 'preflight', storeId: '101', completed: 1, total: 2 })
    logger.report({ phase: 'write-entities', storeId: '101', completed: 2, total: 2 })
    logger.report({ phase: 'unsafe\n\x1b', file: 'bad\nname' })
    // Assert
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('store=101 1/2')
    expect(lines[2]).toContain('2/2')
    expect(lines[3]).not.toContain('\x1b')
    expect(lines[3].split('\n')).toHaveLength(2)
  })
})
