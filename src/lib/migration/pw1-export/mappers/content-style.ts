/** Preserve the existing CSS allowlist; formatting alone is not a fidelity gap. */
export function contentStyle(style: string): { style: string; lostDeclarations: boolean } {
  const declarations = style.split(';').map((part) => part.trim()).filter(Boolean)
  const retained = declarations.filter((part) =>
    /^(color|background-color|font-size)\s*:\s*[#a-z0-9().,%\s-]+$/i.test(part) &&
    !/(?:url|expression)\s*\(/i.test(part),
  )
  return { style: retained.join('; '), lostDeclarations: retained.length !== declarations.length }
}
