import styles from '../ai-settings.module.css'

interface Props {
    count: number
    blocked: boolean
    errorCount: number
    failure: string | null
    onDiscard: () => void
    onSave: () => void
}

const red = { display: 'inline' } as const

/** Sticky "N unsaved changes" bar of the settings page. */
export function SaveBar({ count, blocked, errorCount, failure, onDiscard, onSave }: Props) {
    return (
        <div className={styles.saveBar} role="region" aria-label="Unsaved changes">
            <span>
                <b>{count} unsaved {count === 1 ? 'change' : 'changes'}</b>
                {blocked && <> · <span className={styles.err} style={red}>fix the field in red</span></>}
                {errorCount > 0 && <> · <span className={styles.err} style={red}>{errorCount} {errorCount === 1 ? 'problem' : 'problems'} to fix</span></>}
                {failure && <> · <span className={styles.err} style={red}>{failure}</span></>}
            </span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onDiscard}>Discard</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={blocked || count === 0} onClick={onSave}>Save changes</button>
        </div>
    )
}
