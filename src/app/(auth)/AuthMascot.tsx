'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Mascot, SCENES, type SceneDef } from '@/mascot'

type Mood = 'rest' | 'peek' | 'busy' | 'error' | 'success'

// Typing a password: the robot turns away and drops its arms — it isn't looking.
const LOOK_AWAY: SceneDef = { expr: 'happy', armL: 8, armR: 8, look: [-0.75, 0.12] }

function restScene(pathname: string): SceneDef {
    if (pathname.startsWith('/register')) return SCENES.onboarding
    if (pathname.startsWith('/verify-otp') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')) {
        return SCENES.security
    }
    return SCENES.login
}

const SCENE_FOR: Record<Exclude<Mood, 'rest'>, SceneDef> = {
    peek: LOOK_AWAY,
    busy: SCENES.loading,
    error: SCENES.error,
    success: SCENES.success,
}

/**
 * The sign-in companion beside the auth card (desktop only). It follows the form without
 * the pages knowing: password focus → looks away, submit → busy, error / success toast → reacts.
 */
export function AuthMascot() {
    const pathname = usePathname() ?? '/login'
    const [mood, setMood] = useState<Mood>('rest')

    useEffect(() => {
        let settle: number | undefined
        const react = (next: Mood, ms?: number) => {
            window.clearTimeout(settle)
            setMood(next)
            if (ms) settle = window.setTimeout(() => setMood('rest'), ms)
        }
        const isPassword = (t: EventTarget | null) => t instanceof HTMLInputElement && t.type === 'password'
        const onFocusIn = (e: FocusEvent) => react(isPassword(e.target) ? 'peek' : 'rest')
        const onFocusOut = (e: FocusEvent) => { if (isPassword(e.target)) react('rest') }
        const onSubmit = () => react('busy', 15000)
        // toasts are the auth pages' only feedback channel: read them off the DOM
        const toasts = new MutationObserver((records) => {
            for (const r of records) {
                for (const n of r.addedNodes) {
                    if (!(n instanceof HTMLElement)) continue
                    const type = n.getAttribute('data-type') ?? n.querySelector('[data-sonner-toast]')?.getAttribute('data-type')
                    if (type === 'error') return react('error', 3500)
                    if (type === 'success') return react('success', 4000)
                }
            }
        })
        document.addEventListener('focusin', onFocusIn)
        document.addEventListener('focusout', onFocusOut)
        document.addEventListener('submit', onSubmit, true)
        toasts.observe(document.body, { childList: true, subtree: true })
        return () => {
            window.clearTimeout(settle)
            document.removeEventListener('focusin', onFocusIn)
            document.removeEventListener('focusout', onFocusOut)
            document.removeEventListener('submit', onSubmit, true)
            toasts.disconnect()
        }
    }, [])

    useEffect(() => setMood('rest'), [pathname])

    return (
        <div className="hidden shrink-0 lg:block">
            <Mascot def={mood === 'rest' ? restScene(pathname) : SCENE_FOR[mood]} follow={mood !== 'peek'} size={300} />
        </div>
    )
}
