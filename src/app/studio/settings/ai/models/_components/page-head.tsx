export function PageHead({ title, sub }: { title: string; sub: string }) {
    return (
        <div className="pm-sec-head">
            <h2>{title}</h2>
            <p>{sub}</p>
        </div>
    )
}
