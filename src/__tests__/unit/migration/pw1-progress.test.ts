// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { progressLogger } from '@/lib/migration/pw1-export/progress'

describe('[TC-F42-EXP-013/015] CLI progress metadata', () => {
  it('throttles repeated work for one second but shows stage changes and completion immediately', () => {
    // Arrange
    let time = 0
    const lines: string[] = []
    const progress = progressLogger(
      (line) => lines.push(line),
      () => time,
    )
    // Act
    progress({ phase: 'map-stores', completed: 0, total: 10 })
    time = 999
    progress({ phase: 'map-stores', completed: 1, total: 10 })
    time = 1000
    progress({ phase: 'map-stores', completed: 2, total: 10 })
    progress({ phase: 'map-stores', completed: 10, total: 10 })
    progress({ phase: 'write-artifact', table: 'master.json', bytes: 0 })
    progress({ phase: 'write-artifact', table: 'report.json', bytes: 0 })
    // Assert
    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain('[PW1 +0.0s] map-stores 0/10')
    expect(lines[1]).toContain('[PW1 +1.0s] map-stores 2/10')
    expect(lines[2]).toContain('map-stores 10/10')
    expect(lines[3]).toContain('table=master.json')
    expect(lines[4]).toContain('table=report.json')
  })

  it('neutralizes terminal control characters and line breaks in text metadata', () => {
    // Arrange
    const lines: string[] = []
    const progress = progressLogger(
      (line) => lines.push(line),
      () => 0,
    )
    // Act
    progress({
      phase: 'read\n\x1b[31m',
      table: 'table\r\nforged',
      storeId: '1\u2028\u2029\x00',
    })
    // Assert
    expect(lines).toHaveLength(1)
    expect(lines[0].slice(0, -1)).not.toMatch(/[\r\n\x00\x1b\u2028\u2029]/)
    expect(lines[0]).toMatch(/\n$/)
  })

  it('prints elapsed time, row count and binary megabytes without record contents', () => {
    // Arrange
    let time = 1000
    const lines: string[] = []
    const progress = progressLogger(
      (line) => lines.push(line),
      () => time,
    )
    time = 2500
    // Act
    progress({
      phase: 'read-csv',
      completed: 2,
      total: 3,
      table: 'products',
      rows: 10000,
      bytes: 1572864,
    })
    // Assert
    expect(lines).toEqual([
      '[PW1 +1.5s] read-csv 2/3 table=products rows=10000 MB=1.5\n',
    ])
  })
})
