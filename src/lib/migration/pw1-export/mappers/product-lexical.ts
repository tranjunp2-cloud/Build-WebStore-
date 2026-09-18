import type { Doc, MappingContext, Row } from '../contracts'

/** Lossless source envelope. HTML is stored as text, not parsed or rendered here. */
export function productLexical(
  _ctx: MappingContext,
  row: Row,
  field: 'description' | 'description_ms',
): Doc {
  return sourceTextLexical(row[field] ?? '')
}

export function sourceTextLexical(text: string): Doc {
  return {
    root: {
      type: 'root', version: 1, direction: 'ltr', format: '', indent: 0,
      children: [{
        type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0,
        textFormat: 0, textStyle: '',
        children: [{ type: 'text', version: 1, text, detail: 0,
          format: 0, mode: 'normal', style: '' }],
      }],
    },
  }
}
