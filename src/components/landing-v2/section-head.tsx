/** Centered label + H2 + optional sub used by every section; reveals on scroll. */
export function SectionHead({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <div className="head" data-reveal="up">
      <span className="label">{label}</span>
      <h2 className="h2">{title}</h2>
      {sub ? <p className="sub">{sub}</p> : null}
    </div>
  )
}
