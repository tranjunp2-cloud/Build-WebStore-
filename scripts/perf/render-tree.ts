import { isValidElement, type ReactNode } from 'react'

/** Executes a server component tree like the RSC renderer would for data loading: awaits async components. */
export async function renderTree(node: unknown, depth = 0): Promise<void> {
    if (depth > 60 || node == null || typeof node !== 'object') return
    if (node instanceof Promise) return renderTree(await node, depth + 1)
    if (Array.isArray(node)) {
        await Promise.all(node.map((child) => renderTree(child, depth + 1)))
        return
    }
    if (!isValidElement(node)) return
    const { type, props } = node as { type: unknown; props: { children?: ReactNode } & Record<string, unknown> }
    if (typeof type === 'function') {
        let out: unknown
        try {
            out = (type as (p: unknown) => unknown)(props)
        } catch {
            return // client component (hooks) — no server data loading inside
        }
        if (out instanceof Promise) out = await out.catch((e: unknown) => { throw e })
        return renderTree(out, depth + 1)
    }
    // host elements, fragments, providers, Suspense: walk children and element-valued props
    const kids: unknown[] = []
    for (const value of Object.values(props ?? {})) {
        if (isValidElement(value) || Array.isArray(value)) kids.push(value)
    }
    await Promise.all(kids.map((child) => renderTree(child, depth + 1)))
}
