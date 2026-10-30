interface Props {
    count: number
    blocked?: boolean
    failure?: string | null
    section: string
    onDiscard: () => void
    onSave: () => void
}

/** Sticky "N unsaved changes" bar of one section (like the Limits & prices bar, scoped to the page). */
export function SectionSaveBar({ count, blocked = false, failure, section, onDiscard, onSave }: Props) {
    return (
        <div className="pm-savebar" role="region" aria-label={`Unsaved ${section} changes`}>
            <span>
                <b>{count} unsaved {count === 1 ? 'change' : 'changes'}</b>
                {blocked && <> · <span className="pm-err">fix the field in red</span></>}
                {failure && <> · <span className="pm-err" role="alert">{failure}</span></>}
                {!failure && <span className="pm-dim"> · takes effect within 1 min</span>}
            </span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onDiscard}>Discard</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={blocked || count === 0} onClick={onSave}>Save changes</button>
        </div>
    )
}
