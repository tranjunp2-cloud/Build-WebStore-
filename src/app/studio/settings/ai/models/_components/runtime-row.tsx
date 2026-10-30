import { Switch } from '@/app/studio/_components/ai-limits/switch'
import { fmtRuntime, isEdited, optionLabel, resetEntry, unitOf, type RuntimeEntry } from '@/lib/admin/ai-providers/runtime-draft'
import type { RuntimeView, Source } from '@/lib/admin/ai-providers/types'
import { SourceBadge } from './badges'

interface Props {
    row: RuntimeView
    entry: RuntimeEntry
    problem?: string
    onChange: (entry: RuntimeEntry) => void
}

/** One knob: label, where its value comes from, a one-line meaning, the control, its default and a reset. */
export function RuntimeRow({ row, entry, problem, onChange }: Props) {
    const labelId = `rt-${row.key}`
    const edited = isEdited(row, entry)
    const source: Source = entry.reset ? 'default' : edited ? 'studio' : row.source
    const unit = unitOf(row)
    const set = (value: string | boolean) => onChange({ value, reset: false })
    const resettable = !entry.reset && (row.source === 'studio' || edited)
    return (
        <div className="pm-set">
            <div>
                <div className="pm-set-label"><span id={labelId}>{row.label}</span><SourceBadge source={source} /></div>
                {problem
                    ? <p className="pm-set-help pm-err" role="alert">{problem}</p>
                    : <p className="pm-set-help">{row.help}{row.source === 'env' && <> <span className="pm-env">{row.envName}</span> sets it now.</>}</p>}
            </div>
            <div className="pm-set-ctl">
                <div className="pm-field-row">
                    {row.type === 'enum' && (
                        <div className="pm-seg" role="radiogroup" aria-labelledby={labelId}>
                            {(row.options ?? []).map((option) => (
                                <button key={option} type="button" role="radio" aria-checked={entry.value === option} onClick={() => set(option)}>{optionLabel(option)}</button>
                            ))}
                        </div>
                    )}
                    {row.type === 'bool' && <Switch checked={Boolean(entry.value)} onChange={set} labelledBy={labelId}>{entry.value ? 'On' : 'Off'}</Switch>}
                    {row.type === 'int' && (
                        <span className="acl-num" data-invalid={problem ? '' : undefined}>
                            <input inputMode="decimal" value={String(entry.value)} onChange={(e) => set(e.target.value)} aria-labelledby={labelId} aria-invalid={problem ? true : undefined} />
                            {unit && <span>{unit}</span>}
                        </span>
                    )}
                </div>
                <div className="pm-field-row">
                    <span className="pm-set-def">Default {row.type === 'enum' ? optionLabel(String(row.default)) : fmtRuntime(row, row.default)}</span>
                    {resettable && <button type="button" className="pm-link" onClick={() => onChange(resetEntry(row))} aria-label={`Reset ${row.label} to default`}>Reset to default</button>}
                </div>
            </div>
        </div>
    )
}
