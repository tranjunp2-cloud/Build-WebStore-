// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseJsonChunks } from '@/lib/migration/pw1-export/stream-json'

async function* bytes(input: Uint8Array, size: number) {
  for (let offset = 0; offset < input.length; offset += size)
    yield input.subarray(offset, offset + size)
}

describe('[TC-F42-EXP-013/015] Streaming JSON adversarial boundaries', () => {
  it.each([1, 2, 3, 7, 64])(
    'matches JSON.parse for escape and prototype-looking keys at chunk size %i',
    async (size) => {
      // Arrange
      const source =
        '{"constructor":{"prototype":{"polluted":true}},"__proto__":[],"nested":[{"quoted\\\"":"\\ud800\\udfff\\\\\\/","n":-0.02E-3}],"newline":"\\r\\n","emoji":"😀"}'
      // Act
      const parsed = await parseJsonChunks(bytes(Buffer.from(source), size))
      // Assert
      expect(parsed).toEqual(JSON.parse(source))
      expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype)
      expect(Object.prototype).not.toHaveProperty('polluted')
    },
  )

  it.each([
    '{"a":{} "b":2}',
    '{"a"::1}',
    '{"a":1,,"b":2}',
    '[1,,2]',
    '[,]',
    '{,}',
    '{"a":1',
    '["x"',
    '[truefalse]',
    '[1e+]',
    '[NaN]',
    '"\\u123"',
    '"\\uZZZZ"',
    'true\u00a0',
    '[]null',
  ])('rejects malformed transition or EOF: %j', async (source) => {
    // Arrange
    const chunks = bytes(Buffer.from(source), 1)
    // Act / Assert
    await expect(parseJsonChunks(chunks)).rejects.toThrow()
  })

  it.each([[0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0x80]])(
    'rejects invalid UTF8 sequences even inside a closed string: %j',
    async (...invalid) => {
      // Arrange
      const input = Uint8Array.from([0x22, ...invalid, 0x22])
      // Act / Assert
      await expect(parseJsonChunks(bytes(input, 1))).rejects.toThrow()
    },
  )

  it('propagates visitor errors instead of accepting partially processed arrays', async () => {
    // Arrange
    const expected = new Error('visitor validation failed')
    // Act / Assert
    await expect(
      parseJsonChunks(bytes(Buffer.from('[{},{}]'), 1), () => {
        throw expected
      }),
    ).rejects.toBe(expected)
  })
})
