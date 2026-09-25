import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'

type Frame = {
  kind: 'object' | 'array'
  value: Record<string, unknown> | unknown[]
  state: string
  key: string
  index: number
  path: string[]
}
export type ArrayItemVisitor = (
  path: readonly string[],
  index: number,
  value: unknown,
) => boolean

/** Strict JSON grammar; buffers only an unfinished scalar, never the whole file text.
 * Returning true from visit discards that array item after validation/aggregation.
 */
export async function parseJsonChunks(
  chunks: AsyncIterable<Uint8Array>,
  visit?: ArrayItemVisitor,
): Promise<unknown> {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  const stack: Frame[] = []
  let result: unknown,
    complete = false,
    buffer = ''
  const fail = (): never => {
    throw new SyntaxError('INVALID_JSON')
  }
  const accept = (value: unknown) => {
    const frame = stack.at(-1)
    if (!frame) {
      if (complete) fail()
      result = value
      complete = true
      return
    }
    if (frame.kind === 'array') {
      if (!['value', 'valueOrEnd'].includes(frame.state)) fail()
      if (!visit?.(frame.path, frame.index, value))
        (frame.value as unknown[]).push(value)
      frame.index++
      frame.state = 'commaOrEnd'
    } else {
      if (frame.state !== 'value') fail()
      Object.defineProperty(frame.value, frame.key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      })
      frame.state = 'commaOrEnd'
    }
  }
  const token = (raw: string) => {
    const frame = stack.at(-1)
    if (raw === '}' || raw === ']') {
      if (
        !frame ||
        frame.kind !== (raw === '}' ? 'object' : 'array') ||
        !['keyOrEnd', 'valueOrEnd', 'commaOrEnd'].includes(frame.state)
      )
        fail()
      stack.pop()
      accept(frame!.value)
      return
    }
    if (frame?.kind === 'object' && ['key', 'keyOrEnd'].includes(frame.state)) {
      if (!raw.startsWith('"')) fail()
      frame.key = JSON.parse(raw)
      frame.state = 'colon'
      return
    }
    if (frame?.state === 'colon') {
      if (raw !== ':') fail()
      frame.state = 'value'
      return
    }
    if (frame?.state === 'commaOrEnd') {
      if (raw !== ',') fail()
      frame.state = frame.kind === 'object' ? 'key' : 'value'
      return
    }
    if (raw === '{' || raw === '[') {
      if (complete && !frame) fail()
      const nextPath = frame
        ? [
            ...frame.path,
            frame.kind === 'array' ? String(frame.index) : frame.key,
          ]
        : []
      stack.push({
        kind: raw === '{' ? 'object' : 'array',
        value: raw === '{' ? {} : [],
        state: raw === '{' ? 'keyOrEnd' : 'valueOrEnd',
        key: '',
        index: 0,
        path: nextPath,
      })
      return
    }
    if (
      !raw.startsWith('"') &&
      !/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(
        raw,
      )
    )
      fail()
    accept(JSON.parse(raw))
  }
  function consume(final: boolean) {
    let cursor = 0
    while (cursor < buffer.length) {
      if (/[\x20\t\r\n]/.test(buffer[cursor])) {
        cursor++
        continue
      }
      const start = cursor,
        first = buffer[cursor]
      if ('{}[],:'.includes(first)) {
        token(first)
        cursor++
        continue
      }
      if (first === '"') {
        let end = cursor + 1,
          closed = false
        for (; end < buffer.length; end++) {
          if (buffer[end] === '\\') {
            end++
            continue
          }
          if (buffer[end] === '"') {
            end++
            closed = true
            break
          }
        }
        if (!closed) {
          if (final) fail()
          break
        }
        token(buffer.slice(start, end))
        cursor = end
      } else {
        let end = cursor
        while (end < buffer.length && !/[\x20\t\r\n{}\[\],:]/.test(buffer[end]))
          end++
        if (end === buffer.length && !final) break
        token(buffer.slice(start, end))
        cursor = end
      }
    }
    buffer = buffer.slice(cursor)
  }
  for await (const chunk of chunks) {
    buffer += decoder.decode(chunk, { stream: true })
    consume(false)
  }
  buffer += decoder.decode()
  consume(true)
  if (!complete || stack.length || buffer.length) fail()
  return result
}
export async function readJsonStream(
  filename: string,
  visit?: ArrayItemVisitor,
): Promise<unknown> {
  return parseJsonChunks(createReadStream(filename), visit)
}
export async function hashFileStream(filename: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}
