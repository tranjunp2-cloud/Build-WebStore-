'use client'

import { MascotRendererProvider, type MascotMood, type MascotRenderer } from '@ech/agent-ui/mascot'
import type { ReactNode } from 'react'
import { type AvatarState, MascotAvatar, MascotProvider } from '@/mascot'

const AVATAR_FOR_MOOD: Record<MascotMood, AvatarState> = {
    idle: 'idle',
    thinking: 'thinking',
    // something waits for the merchant (badge, a question): the robot looks up, surprised
    alert: 'wow',
    speaking: 'speaking',
    happy: 'happy',
    error: 'error',
}

// Moods whose face moves (mouth, dots, ring) get the full frame rate; a resting chat-row avatar
// only breathes and blinks, so 12 fps is indistinguishable and frees the GPU for the live one.
const ACTIVE = new Set<MascotMood>(['thinking', 'speaking', 'alert'])
function fpsFor(size: number, mood: MascotMood) {
    if (size >= 40) return undefined // the launcher: kit default (30 fps at ≤48px)
    return ACTIVE.has(mood) ? 30 : 12
}

/**
 * The agent UI's mascot (dock button, chat rows) as the 3D robot; the SVG stays until it is ready.
 * Always mount MascotAvatar: it is what asks the provider for the 3D runtime once it is on screen.
 * Gating on useMascotStore() here kept the store null forever on pages with no other robot (editor chat).
 */
function AgentMascot3D({ size, mood, fallback }: { size: number; mood: MascotMood; fallback: ReactNode }) {
    return (
        <MascotAvatar
            state={AVATAR_FOR_MOOD[mood]}
            size={size}
            fps={fpsFor(size, mood)}
            // only the launcher watches the pointer; a column of chat avatars turning at once is noise
            follow={size >= 40}
            fallback={<span style={{ transform: 'scale(.72)' }}>{fallback}</span>}
            // the floating dock button has no frame of its own: lift it off the page like the SVG did
            style={size >= 40 ? { filter: 'drop-shadow(0 6px 14px rgb(10 166 196 / 0.35))' } : undefined}
        />
    )
}

const renderAgentMascot: MascotRenderer = (props) => <AgentMascot3D {...props} />

/** One shared 3D runtime per layout, plus the 3D robot inside every agent surface. */
export function AppMascotProvider({ children }: { children: ReactNode }) {
    return (
        <MascotProvider>
            <MascotRendererProvider render={renderAgentMascot}>{children}</MascotRendererProvider>
        </MascotProvider>
    )
}
