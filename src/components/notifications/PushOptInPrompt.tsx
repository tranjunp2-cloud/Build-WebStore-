'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, X } from 'lucide-react'
import { useI18n } from '@/i18n'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function registerAndSubscribe(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
  })

  // Send subscription to server
  const res = await fetch('/api/notifications/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(subscription.toJSON()),
  })

  if (!res.ok) throw new Error('Failed to save subscription')
  return subscription
}

export function PushOptInPrompt() {
  const [show, setShow] = useState(false)
  const { t } = useI18n()

  // Auto re-subscribe on every mount if permission already granted
  // This ensures each user (even on shared browser) has their subscription saved
  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') {
      registerAndSubscribe().catch((err) =>
        console.warn('[Push] Auto re-subscribe failed', err),
      )
    }
  }, [])

  const shouldShowPrompt = useCallback(() => {
    if (!VAPID_PUBLIC_KEY) return false
    if (typeof window === 'undefined') return false
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
    if (Notification.permission === 'denied') return false
    if (Notification.permission === 'granted') return false
    if (localStorage.getItem('push-opt-in-completed')) return false
    const dismissed = localStorage.getItem('push-opt-in-dismissed')
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return false
    }
    return true
  }, [])

  useEffect(() => {
    const wizardSeen = !document.querySelector('[data-wizard-open]')
    if (wizardSeen && shouldShowPrompt()) {
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }

    const handleWizardClosed = () => {
      if (shouldShowPrompt()) {
        setTimeout(() => setShow(true), 1500)
      }
    }
    window.addEventListener('wizard-closed', handleWizardClosed)
    return () => window.removeEventListener('wizard-closed', handleWizardClosed)
  }, [shouldShowPrompt])

  const handleEnable = async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await registerAndSubscribe()
        localStorage.setItem('push-opt-in-completed', 'true')
      }
    } catch (err) {
      console.error('[Push] Opt-in failed', err)
    }
    setShow(false)
  }

  const handleLater = () => {
    localStorage.setItem('push-opt-in-dismissed', Date.now().toString())
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 z-[150] w-[320px] rounded-2xl bg-[#1E293B] border border-white/10 shadow-2xl p-5 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <button
        onClick={handleLater}
        className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
          <Bell className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h4 className="text-[14px] font-semibold text-white leading-tight mb-1">
            {t.notifications.push.title}
          </h4>
          <p className="text-[12px] text-[#94A3B8] leading-relaxed">
            {t.notifications.push.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleEnable}
          className="flex-1 h-[36px] rounded-lg bg-gradient-to-r from-blue-500 to-teal-400 text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          {t.notifications.push.enable}
        </button>
        <button
          onClick={handleLater}
          className="flex-1 h-[36px] rounded-lg text-white/60 text-[13px] font-medium hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          {t.notifications.push.later}
        </button>
      </div>
    </div>
  )
}
