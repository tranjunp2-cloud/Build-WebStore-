'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../types'
import type { ClassScheduleConfig, ClassItem } from './config'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CapacityBar({ capacity, enrolled = 0 }: { capacity: number; enrolled?: number }) {
    const pct = Math.min((enrolled / capacity) * 100, 100)
    const isFull = enrolled >= capacity
    return (
        <div className="flex items-center gap-2 text-xs">
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(var(--brand-primary-rgb), 0.125)` }}>
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: isFull ? '#ef4444' : 'var(--brand-primary)' }}
                />
            </div>
            <span className={isFull ? 'text-red-500 font-semibold' : 'opacity-50'}>
                {isFull ? 'Full' : `${enrolled}/${capacity}`}
            </span>
        </div>
    )
}

export function ClassScheduleBlock({ block }: BlockProps<ClassScheduleConfig>) {
    const {
        headline,
        classes = [],
        variant = 'grid',
        showCapacity = true,
        highlightToday = true,
    } = block

    const today = new Date().getDay()
    const [activeDay, setActiveDay] = useState(today)

    const classesByDay = useMemo(() => {
        const map: Record<number, ClassItem[]> = {}
        for (let d = 0; d < 7; d++) map[d] = []
        classes.forEach((c) => {
            if (map[c.day]) map[c.day].push(c)
        })
        // Sort by start time within each day
        Object.values(map).forEach((arr) => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
        return map
    }, [classes])

    const daysWithClasses = useMemo(() => {
        return Array.from(new Set(classes.map((c) => c.day))).sort()
    }, [classes])

    /* ── Grid variant: weekly timetable ──────────────────────────────────────── */
    const renderGrid = () => (
        <div className="overflow-x-auto -mx-6 px-6">
            <div className="min-w-[800px]">
                <div className="grid grid-cols-8 gap-px rounded-2xl overflow-hidden" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                    {/* Header row */}
                    <div className="p-3 text-sm font-semibold opacity-50" style={{ background: `rgba(var(--brand-primary-rgb), 0.02)` }}>
                        Time
                    </div>
                    {DAY_NAMES_SHORT.map((day, i) => (
                        <div
                            key={i}
                            className="p-3 text-sm font-semibold text-center"
                            style={{
                                background: highlightToday && i === today
                                    ? `rgba(var(--brand-primary-rgb), 0.082)`
                                    : `rgba(var(--brand-primary-rgb), 0.02)`,
                                color: highlightToday && i === today ? 'var(--brand-primary)' : 'inherit',
                            }}
                        >
                            {day}
                        </div>
                    ))}

                    {/* Time rows */}
                    {Array.from({ length: 12 }, (_, i) => {
                        const hour = 7 + i
                        const timeLabel = `${hour.toString().padStart(2, '0')}:00`
                        return (
                            <div key={hour} className="contents">
                                <div className="p-3 text-xs opacity-40" style={{ background: `rgba(var(--brand-primary-rgb), 0.01)` }}>
                                    {timeLabel}
                                </div>
                                {Array.from({ length: 7 }, (_, d) => {
                                    const cellClasses = classesByDay[d]?.filter((c) => {
                                        const [h] = c.startTime.split(':').map(Number)
                                        return h === hour
                                    }) ?? []
                                    return (
                                        <div
                                            key={d}
                                            className="p-2 min-h-[60px]"
                                            style={{
                                                background: highlightToday && d === today
                                                    ? `rgba(var(--brand-primary-rgb), 0.02)`
                                                    : 'transparent',
                                            }}
                                        >
                                            {cellClasses.map((c, ci) => (
                                                <div
                                                    key={ci}
                                                    className="p-2 rounded-lg text-xs mb-1"
                                                    style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, borderLeft: `3px solid var(--brand-primary)` }}
                                                >
                                                    <p className="font-bold leading-tight">{c.name}</p>
                                                    <p className="opacity-60">{c.startTime} - {c.endTime}</p>
                                                    <p className="opacity-50">{c.instructor}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )

    /* ── List variant: day tabs + class rows ──────────────────────────────────── */
    const renderList = () => (
        <div>
            <div className="flex flex-wrap justify-center gap-3 mb-10" role="tablist">
                {daysWithClasses.map((d) => (
                    <button
                        key={d}
                        role="tab"
                        aria-selected={activeDay === d}
                        onClick={() => setActiveDay(d)}
                        className="px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                        style={activeDay === d
                            ? { background: 'var(--brand-primary)', color: '#fff' }
                            : {
                                background: `rgba(var(--brand-primary-rgb), 0.063)`,
                                border: `1px solid rgba(var(--brand-primary-rgb), 0.125)`,
                                color: highlightToday && d === today ? 'var(--brand-primary)' : 'inherit',
                            }
                        }
                    >
                        {DAY_NAMES[d]}
                        {highlightToday && d === today && <span className="ml-1.5 text-xs opacity-60">(Today)</span>}
                    </button>
                ))}
            </div>
            <div className="max-w-3xl mx-auto space-y-3">
                {(classesByDay[activeDay] ?? []).map((c, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-4 p-5 rounded-xl transition-shadow duration-200 hover:shadow-md"
                        style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                    >
                        <div
                            className="text-center px-4 py-2 rounded-lg shrink-0"
                            style={{ background: `rgba(var(--brand-primary-rgb), 0.063)` }}
                        >
                            <p className="text-sm font-bold" style={{ color: 'var(--brand-primary)' }}>{c.startTime}</p>
                            <p className="text-xs opacity-40">{c.endTime}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold font-heading">{c.name}</h4>
                                {c.level && (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-xs"
                                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                                    >
                                        {c.level}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm opacity-50">{c.instructor}{c.category ? ` \u2022 ${c.category}` : ''}</p>
                        </div>
                        {showCapacity && <CapacityBar capacity={c.capacity} enrolled={c.enrolled} />}
                    </motion.div>
                ))}
                {(classesByDay[activeDay] ?? []).length === 0 && (
                    <p className="text-center opacity-40 py-8">No classes scheduled for this day.</p>
                )}
            </div>
        </div>
    )

    /* ── Cards variant ───────────────────────────────────────────────────────── */
    const renderCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((c, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 rounded-2xl transition-shadow duration-300 hover:shadow-lg"
                    style={{
                        border: `1px solid rgba(var(--brand-primary-rgb), ${highlightToday && c.day === today ? 0.25 : 0.082})`,
                        background: highlightToday && c.day === today ? `rgba(var(--brand-primary-rgb), 0.02)` : 'transparent',
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <span
                            className="px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                                background: highlightToday && c.day === today ? 'var(--brand-primary)' : `rgba(var(--brand-primary-rgb), 0.082)`,
                                color: highlightToday && c.day === today ? '#fff' : 'var(--brand-primary)',
                            }}
                        >
                            {DAY_NAMES_SHORT[c.day]}
                            {highlightToday && c.day === today ? ' (Today)' : ''}
                        </span>
                        {c.level && <span className="text-xs opacity-40">{c.level}</span>}
                    </div>
                    <h4 className="text-lg font-bold font-heading mb-1">{c.name}</h4>
                    <p className="text-sm opacity-50 mb-3">{c.instructor}{c.category ? ` \u2022 ${c.category}` : ''}</p>
                    <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--brand-primary)' }}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{c.startTime} - {c.endTime}</span>
                    </div>
                    {showCapacity && <CapacityBar capacity={c.capacity} enrolled={c.enrolled} />}
                </motion.div>
            ))}
        </div>
    )

    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                </div>

                {variant === 'grid' && renderGrid()}
                {variant === 'list' && renderList()}
                {variant === 'cards' && renderCards()}
            </div>
        </section>
    )
}
