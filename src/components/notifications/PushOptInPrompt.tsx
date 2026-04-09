'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, X } from 'lucide-react'

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

  const shouldShow = useCallback(() => {
    if (!VAPID_PUBLIC_KEY) return false
    if (typeof window === 'undefined') return false
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
    if (Notification.permission === 'denied') return false
    if (Notification.permission === 'granted') {
      // Already granted — silently register SW + subscribe
      registerAndSubscribe().catch((err) =>
        console.warn('[Push] Silent re-subscribe failed', err),
      )
      return false
    }
    if (localStorage.getItem('push-opt-in-completed')) return false
    const dismissed = localStorage.getItem('push-opt-in-dismissed')
    if (dismissed) {
      // Re-prompt after 7 days
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return false
    }
    return true
  }, [])

  useEffect(() => {
    // Show immediately if wizard was already seen
    const wizardSeen = !document.querySelector('[data-wizard-open]')
    if (wizardSeen && shouldShow()) {
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }

    // Listen for wizard close event
    const handleWizardClosed = () => {
      if (shouldShow()) {
        setTimeout(() => setShow(true), 1500)
      }
    }
    window.addEventListener('wizard-closed', handleWizardClosed)
    return () => window.removeEventListener('wizard-closed', handleWizardClosed)
  }, [shouldShow])

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
            Enable desktop notifications?
          </h4>
          <p className="text-[12px] text-[#94A3B8] leading-relaxed">
            Get notified about new orders and updates even when this tab is in the background.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleEnable}
          className="flex-1 h-[36px] rounded-lg bg-gradient-to-r from-blue-500 to-teal-400 text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Enable
        </button>
        <button
          onClick={handleLater}
          className="flex-1 h-[36px] rounded-lg text-white/60 text-[13px] font-medium hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  )
}
