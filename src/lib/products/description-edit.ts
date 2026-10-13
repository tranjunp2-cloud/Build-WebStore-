/** Plain-text projection for the current textarea, not a rich-text serializer. */
export function lexicalToText(data: unknown): string {
  if (typeof data === 'string') return data
  if (!data || typeof data !== 'object' || !('root' in data)) return ''
  const traverse = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    if ('type' in node && node.type === 'text' && 'text' in node)
      return typeof node.text === 'string' ? node.text : ''
    const children = 'children' in node && Array.isArray(node.children)
      ? node.children.map(traverse).join('') : ''
    return children + ('type' in node && node.type === 'paragraph' ? '\n\n' : '')
  }
  return traverse(data.root).trim()
}

export function descriptionEditPatch(current: string | undefined, initial: string | undefined, isNew: boolean) {
  // Omission preserves uploads, links, styles and concurrent changes when untouched.
  if (!isNew && (current ?? '') === (initial ?? '')) return {}
  if (!current) return isNew ? {} : { description: null }
  return {
    description: {
      root: {
        type: 'root', format: '', indent: 0, version: 1,
        children: current.split('\n\n').map((text) => ({
          type: 'paragraph', format: '', indent: 0, version: 1,
          children: text ? [{ type: 'text', text, mode: 'normal', style: '', detail: 0, format: 0, version: 1 }] : [],
        })),
      },
    },
  }
}
