'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Check, Info, AlarmClockOff, TriangleAlert, CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

// Public holidays (MY) — v1 placeholder; replace with a real holiday source before production use.
const HOLIDAYS: string[] = ['2026-06-25']
const MORNING_CUTOFF_H = 11
const AFTERNOON_CUTOFF_H = 17
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toDM(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
function isOff(d: Date) {
  return d.getDay() === 0 || HOLIDAYS.includes(toIso(d))
}

interface SchedulePickupPopoverProps {
  orderId: string | number
  onCancel: () => void
  onConfirm: (label: string) => void
}

export function SchedulePickupPopover({ orderId, onCancel, onConfirm }: SchedulePickupPopoverProps) {
  const { t } = useI18n()
  const pk = t.dashboard.orders.pickup
  const now = useMemo(() => new Date(), [])
  const hour = now.getHours()
  const today = now
  const tomorrow = useMemo(() => new Date(now.getTime() + 86400000), [now])
  const todayClosed = isOff(today) || hour >= AFTERNOON_CUTOFF_H
  const tomorrowOff = isOff(tomorrow)

  const [mode, setMode] = useState<'today' | 'tomorrow' | 'other'>(
    todayClosed ? 'tomorrow' : 'today',
  )
  const [customDate, setCustomDate] = useState('')
  const [slot, setSlot] = useState<'am' | 'pm' | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedDate =
    mode === 'today' ? today :
    mode === 'tomorrow' ? tomorrow :
    (customDate ? new Date(customDate + 'T00:00:00') : null)

  const selectedOff = selectedDate ? isOff(selectedDate) : true
  const customOff = mode === 'other' && !!selectedDate && selectedOff
  const isToday = !!selectedDate && toIso(selectedDate) === toIso(today)
  const morningOpen = !isToday || hour < MORNING_CUTOFF_H
  const afternoonOpen = !isToday || hour < AFTERNOON_CUTOFF_H
  const morningHidden = isToday && !morningOpen
  const dateValid = !!selectedDate && !selectedOff && !(mode === 'today' && hour >= AFTERNOON_CUTOFF_H)

  // Auto-select first available slot when date changes
  useEffect(() => {
    if (!dateValid) { setSlot(null); return }
    setSlot(s => {
      if (s === 'am' && !morningOpen) return afternoonOpen ? 'pm' : null
      if (s === 'pm' && !afternoonOpen) return morningOpen ? 'am' : null
      if (!s) return morningOpen ? 'am' : afternoonOpen ? 'pm' : null
      return s
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, customDate])

  const canConfirm = dateValid && ((slot === 'am' && morningOpen) || (slot === 'pm' && afternoonOpen))
  const slotLabel = slot === 'am' ? pk.slotMorning : slot === 'pm' ? pk.slotAfternoon : ''

  const dateLabel =
    mode === 'today' ? `Today ${toDM(today)}` :
    mode === 'tomorrow' ? `Tomorrow ${toDM(tomorrow)}` :
    (selectedDate ? `${DOW[selectedDate.getDay()]} ${toDM(selectedDate)}` : '')

  const handleConfirm = async () => {
    if (!canConfirm || !selectedDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: toIso(selectedDate), slot: slot ?? undefined }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error?.message ?? pk.saveFailed)
      }
      onConfirm(`${dateLabel} · ${slotLabel}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : pk.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sched-pop sched-pop-wide" onClick={e => e.stopPropagation()}>
      <div className="sched-pop-h">{pk.title}</div>

      <div className="sched-label">{pk.dateLabel}</div>
      <div className="sched-days">
        <button
          className={`sched-day${mode === 'today' ? ' on' : ''}`}
          disabled={todayClosed}
          onClick={() => setMode('today')}
        >
          <span className="sd-dow">{DOW[today.getDay()]}</span>
          <span className="sd-main">{pk.today}</span>
          <span className="sd-date">{toDM(today)}</span>
          {todayClosed && <span className="sd-off">{isOff(today) ? pk.closed : pk.cutoff}</span>}
        </button>
        <button
          className={`sched-day${mode === 'tomorrow' ? ' on' : ''}`}
          disabled={tomorrowOff}
          onClick={() => setMode('tomorrow')}
        >
          <span className="sd-dow">{DOW[tomorrow.getDay()]}</span>
          <span className="sd-main">{pk.tomorrow}</span>
          <span className="sd-date">{toDM(tomorrow)}</span>
          {tomorrowOff && <span className="sd-off">{pk.closed}</span>}
        </button>
        <button
          className={`sched-day${mode === 'other' ? ' on' : ''}`}
          onClick={() => setMode('other')}
        >
          <span className="sd-dow">&nbsp;</span>
          <span className="sd-main">{pk.pickADate}</span>
          <span className="sd-date">{pk.date}</span>
        </button>
      </div>

      {mode === 'other' && (
        <div className="sched-custom">
          <input
            type="date"
            value={customDate}
            min={toIso(today)}
            onChange={e => setCustomDate(e.target.value)}
          />
          {customOff && (
            <div className="sched-warn">
              <TriangleAlert /> {pk.holidayWarning}
            </div>
          )}
        </div>
      )}

      <div className="sched-label sched-label-2">{pk.timeSlotLabel}</div>
      {dateValid ? (
        <>
          <div className="sched-slots">
            {!morningHidden && (
              <button
                className={`sched-slot${slot === 'am' ? ' on' : ''}`}
                disabled={!morningOpen}
                onClick={() => setSlot('am')}
              >
                <span className="ss-time">08:00 – 12:00</span>
                <span className="ss-name">{pk.morning}</span>
              </button>
            )}
            <button
              className={`sched-slot${slot === 'pm' ? ' on' : ''}`}
              disabled={!afternoonOpen}
              onClick={() => setSlot('pm')}
            >
              <span className="ss-time">13:00 – 18:00</span>
              <span className="ss-name">{pk.afternoon}</span>
            </button>
          </div>
          {morningHidden && (
            <div className="sched-cutoff">
              <AlarmClockOff /> {pk.morningCutoffPassed}
            </div>
          )}
        </>
      ) : (
        <div className="sched-slot-empty">{pk.selectDateFirst}</div>
      )}

      <div className="sched-pop-foot">
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>{pk.cancel}</button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!canConfirm || saving}
          onClick={handleConfirm}
        >
          {saving ? <span className="spin" /> : <Check style={{ width: 14, height: 14 }} />}
          {pk.confirm}
        </button>
      </div>

      <div className="sched-pop-note">
        <Info /> {pk.note}
      </div>
    </div>
  )
}

interface ScheduledPickupLockedProps {
  label: string
}
export function ScheduledPickupLocked({ label }: ScheduledPickupLockedProps) {
  return (
    <div className="sched-locked">
      <CalendarCheck style={{ width: 15, height: 15 }} /> Pickup · <b>{label}</b>
    </div>
  )
}
