// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseJsonChunks } from '@/lib/migration/pw1-export/stream-json'
async function* chunks(input: string, size = 1) {
  const bytes = Buffer.from(input)
  for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size)
}
describe('[TC-F42-EXP-015] strict streaming JSON artifact reader', () => {
  it('preserves UTF8, escape sequences, numeric types and container boundaries', async () => {
    // Arrange
    const json =
      '{"unicode":"Tiếng Việt 😀","escape":"\\\"\\\\\\n\\u2028","values":[-1.25e+3,0,true,false,null,{},[]],"__proto__":{"polluted":true}}'
    // Act
    const parsed = await parseJsonChunks(chunks(json))
    // Assert
    expect(parsed).toEqual(JSON.parse(json))
    expect(Object.prototype).not.toHaveProperty('polluted')
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true)
  })
  it('keeps JSON.parse duplicate key semantics and supports discarding streamed array records', async () => {
    // Arrange
    const visited: unknown[] = []
    // Act
    const parsed = await parseJsonChunks(
      chunks('{"x":1,"x":2,"rows":[{},null,[1]]}', 3),
      (path, index, value) => {
        if (path.join('.') !== 'rows') return false
        visited.push([index, value])
        return true
      },
    )
    // Assert
    expect(parsed).toEqual({ x: 2, rows: [] })
    expect(visited).toEqual([
      [0, {}],
      [1, null],
      [2, [1]],
    ])
  })
  it.each([
    '',
    ' ',
    '[1,]',
    '{"a":1,}',
    '{"a":}',
    '[',
    '{',
    '"abc',
    '"bad\\x"',
    '"a\nb"',
    '01',
    '+1',
    '1.',
    '1e',
    'undefined',
    '[true false]',
    '{}{}',
    'null true',
    '{"a" 1}',
    '[}',
    '\ufeff{}',
  ])('rejects malformed JSON %j', async (json) => {
    await expect(parseJsonChunks(chunks(json, 2))).rejects.toThrow()
  })
  it('rejects invalid or truncated UTF8 at EOF', async () => {
    async function* invalid() {
      yield Uint8Array.from([0x22, 0xe2, 0x82])
    }
    await expect(parseJsonChunks(invalid())).rejects.toThrow()
  })
})
