'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import type { BookingWidgetConfig, BookingService } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function generateTimeSlots(start: string, end: string, interval: number): string[] {
    const slots: string[] = []
    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    let current = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    while (current < endMinutes) {
        const h = Math.floor(current / 60)
        const m = current % 60
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
        current += interval
    }
    return slots
}

function getNextDays(availableDays: number[], count: number): Date[] {
    const dates: Date[] = []
    const today = new Date()
    let d = new Date(today)
    while (dates.length < count) {
        if (availableDays.includes(d.getDay())) {
            dates.push(new Date(d))
        }
        d.setDate(d.getDate() + 1)
    }
    return dates
}

function BookingForm({
    services,
    availableDays,
    timeSlotInterval,
    startTime,
    endTime,
    bookingUrl,
    showPrice,
    currency = 'RM',
}: {
    services: BookingService[]
    availableDays: number[]
    timeSlotInterval: number
    startTime: string
    endTime: string
    bookingUrl?: string
    showPrice: boolean
    currency?: string
}) {
    const [selectedService, setSelectedService] = useState(0)
    const [selectedDate, setSelectedDate] = useState<number | null>(null)
    const [selectedTime, setSelectedTime] = useState<string | null>(null)

    const timeSlots = useMemo(
        () => generateTimeSlots(startTime, endTime, timeSlotInterval),
        [startTime, endTime, timeSlotInterval],
    )

    const nextDates = useMemo(() => getNextDays(availableDays, 14), [availableDays])

    const service = services[selectedService]

    return (
        <div className="space-y-8">
            {/* Step 1: Service */}
            <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-4">1. Select Service</h4>
                <div className="space-y-3">
                    {services.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => { setSelectedService(i); setSelectedDate(null); setSelectedTime(null) }}
                            className="w-full text-left p-4 rounded-xl transition-all duration-200"
                            style={{
                                border: `2px solid ${selectedService === i ? 'var(--brand-primary)' : `rgba(var(--brand-primary-rgb), 0.082)`}`,
                                background: selectedService === i ? `rgba(var(--brand-primary-rgb), 0.04)` : 'transparent',
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold font-heading">{s.name}</p>
                                    <p className="text-sm opacity-50">{s.duration} min</p>
                                    {s.description && <p className="text-sm opacity-40 mt-1">{s.description}</p>}
                                </div>
                                {showPrice && (
                                    <span className="font-bold text-lg shrink-0" style={{ color: 'var(--brand-primary)' }}>
                                        {currency} {s.price.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2: Date */}
            <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-4">2. Choose Date</h4>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {nextDates.map((date, i) => {
                        const isSelected = selectedDate === i
                        return (
                            <button
                                key={i}
                                onClick={() => { setSelectedDate(i); setSelectedTime(null) }}
                                className="flex flex-col items-center px-4 py-3 rounded-xl shrink-0 transition-all duration-200"
                                style={{
                                    border: `2px solid ${isSelected ? 'var(--brand-primary)' : `rgba(var(--brand-primary-rgb), 0.082)`}`,
                                    background: isSelected ? 'var(--brand-primary)' : 'transparent',
                                    color: isSelected ? '#fff' : 'inherit',
                                }}
                            >
                                <span className="text-xs font-medium">{DAY_NAMES[date.getDay()]}</span>
                                <span className="text-lg font-bold">{date.getDate()}</span>
                                <span className="text-xs opacity-60">{date.toLocaleDateString('en', { month: 'short' })}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Step 3: Time */}
            {selectedDate !== null && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <h4 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-4">3. Select Time</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {timeSlots.map((slot) => {
                            const isSelected = selectedTime === slot
                            return (
                                <button
                                    key={slot}
                                    onClick={() => setSelectedTime(slot)}
                                    className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200"
                                    style={{
                                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : `rgba(var(--brand-primary-rgb), 0.125)`}`,
                                        background: isSelected ? 'var(--brand-primary)' : 'transparent',
                                        color: isSelected ? '#fff' : 'inherit',
                                    }}
                                >
                                    {slot}
                                </button>
                            )
                        })}
                    </div>
                </motion.div>
            )}

            {/* Submit */}
            {selectedTime && service && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-4">
                    <div
                        className="p-4 rounded-xl mb-4"
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.04)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                    >
                        <p className="text-sm opacity-50">Booking Summary</p>
                        <p className="font-bold font-heading">{service.name}</p>
                        <p className="text-sm opacity-60">
                            {nextDates[selectedDate!]?.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })} at {selectedTime}
                        </p>
                    </div>
                    {bookingUrl ? (
                        <a
                            href={bookingUrl}
                            className="block w-full py-3.5 rounded-xl font-semibold text-center text-white transition-opacity hover:opacity-90"
                            style={{ background: 'var(--brand-primary)' }}
                        >
                            Confirm Booking
                        </a>
                    ) : (
                        <button
                            className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ background: 'var(--brand-primary)' }}
                        >
                            Confirm Booking
                        </button>
                    )}
                </motion.div>
            )}
        </div>
    )
}

export function BookingWidgetBlock({ block }: BlockProps<BookingWidgetConfig>) {
    const {
        headline,
        subheadline,
        services = [],
        variant = 'inline',
        availableDays = [1, 2, 3, 4, 5],
        timeSlotInterval = 30,
        startTime = '09:00',
        endTime = '18:00',
        bookingUrl,
        showPrice = true,
    } = block

    const [showModal, setShowModal] = useState(false)

    const formProps = { services, availableDays, timeSlotInterval, startTime, endTime, bookingUrl, showPrice }

    /* ── Inline ──────────────────────────────────────────────────────────────── */
    if (variant === 'inline') {
        return (
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                        {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
                    </div>
                    <div className="max-w-2xl mx-auto">
                        <BookingForm {...formProps} />
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    /* ── Sidebar ─────────────────────────────────────────────────────────────── */
    if (variant === 'sidebar') {
        return (
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                        <div>
                            <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                            {subheadline && <p className="text-lg opacity-50 leading-relaxed mb-8">{subheadline}</p>}
                            <div className="space-y-4">
                                {services.map((s, i) => (
                                    <div
                                        key={i}
                                        className="p-5 rounded-xl"
                                        style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                                    >
                                        <h3 className="font-bold font-heading mb-1">{s.name}</h3>
                                        <p className="text-sm opacity-50">{s.duration} min{s.description ? ` — ${s.description}` : ''}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="lg:sticky lg:top-8">
                            <div
                                className="p-8 rounded-2xl"
                                style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)`, background: `rgba(var(--brand-primary-rgb), 0.02)` }}
                            >
                                <h3 className="text-xl font-bold font-heading mb-6">Book Now</h3>
                                <BookingForm {...formProps} />
                            </div>
                        </div>
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    /* ── Modal Trigger ───────────────────────────────────────────────────────── */
    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                    {subheadline && <p className="text-lg opacity-50 leading-relaxed mb-8">{subheadline}</p>}
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-8 py-4 rounded-xl font-semibold text-white text-lg transition-opacity hover:opacity-90"
                        style={{ background: 'var(--brand-primary)' }}
                    >
                        Book an Appointment
                    </button>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ background: 'rgba(0,0,0,0.6)' }}
                        onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Booking form"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-8"
                            style={{ background: 'var(--brand-surface, #fff)', border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold font-heading">Book Appointment</h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full opacity-50 hover:opacity-100 transition-opacity"
                                    aria-label="Close"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <BookingForm {...formProps} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AnimatedSection>
    )
}
