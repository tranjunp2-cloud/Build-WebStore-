'use client';
// Round avatar for the AI chat, comments, notifications... Background, status ring and presence dot
// are CSS (sharp at any size, no GPU); only the robot is 3D.
import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { AVATAR_STATES, AvatarDef, AvatarState, avatarScene } from '../core/scenes';
import type { MascotInstance } from './store';
import { useMascotRuntime } from './MascotProvider';

export interface MascotAvatarProps {
  state?: AvatarState;
  size?: number;
  theme?: 'brand' | 'light' | 'dark';
  /** presence dot */
  dot?: 'online' | 'busy' | 'away';
  /** status ring (spins while thinking / typing, pulses while speaking / listening) */
  ring?: boolean;
  follow?: boolean;
  fps?: number;
  /** drawn inside the circle until the 3D robot has its first frame */
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** screen-reader label; without it the avatar is decorative (aria-hidden) */
  label?: string;
  /** never download the 3D runtime for this mascot; show the robot only if it is already loaded */
  passive?: boolean;
}

const BG = {
  brand: 'linear-gradient(155deg,#3fdcee 0%,#0aa6c4 55%,#1d3f94 100%)',
  light: 'linear-gradient(155deg,#f4fcff 0%,#c9ebf4 100%)',
  dark: 'linear-gradient(155deg,#22386b 0%,#0b1530 100%)'
};
const DOT = { online: '#2ecc8f', busy: '#ff5d6c', away: '#ffc233' };

let styleInjected = false;
function injectKeyframes() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;
  const el = document.createElement('style');
  el.textContent =
    '@keyframes pmSpin{to{transform:rotate(360deg)}}' +
    '@keyframes pmPulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.14);opacity:0}}' +
    '@media (prefers-reduced-motion: reduce){.pm-ring{animation:none!important}}';
  document.head.appendChild(el);
}

export function MascotAvatar({ state = 'idle', size = 40, theme = 'brand', dot, ring = true, follow = true, fps, fallback, className, style, label, passive = false }: MascotAvatarProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const store = useMascotRuntime(ref, passive);
  const inst = useRef<MascotInstance | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(injectKeyframes, []);
  useEffect(() => {
    const el = ref.current;
    if (!store || !el) return;
    const onReady = () => setReady(true);
    el.addEventListener('mascotready', onReady);
    const i = store.register({ kind: 'avatar', el, size, def: avatarScene(state), follow, fps });
    inst.current = i;
    return () => { el.removeEventListener('mascotready', onReady); store.unregister(i); inst.current = null; };
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const i = inst.current; if (i && i.state.expr !== avatarScene(state).expr) store?.setDef(i, avatarScene(state)); }, [store, state]);
  useEffect(() => { const i = inst.current; if (i && i.size !== size) store?.resize(i, size); }, [store, size]);
  useEffect(() => { if (inst.current) inst.current.follow = follow; }, [follow]);
  useEffect(() => { const i = inst.current; if (i) store?.setFps(i, fps); }, [store, fps]);

  const a: AvatarDef = (AVATAR_STATES as Record<string, AvatarDef>)[state] ?? AVATAR_STATES.idle;
  const bw = Math.max(1.5, size * 0.03);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span {...a11y} className={className}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: 'none', ...style }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', background: BG[theme], isolation: 'isolate' }}>
        <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 35% 15%, rgba(255,255,255,.45), rgba(255,255,255,0) 55%)' }} />
        {!ready && fallback && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{fallback}</span>}
        <canvas ref={ref} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: 0, transition: 'opacity .35s ease-out' }} />
      </span>
      {ring && (
        a.ring === 'spin' ? (
          <span className="pm-ring" style={{ position: 'absolute', inset: -bw * 0.5, borderRadius: '50%', border: `${bw}px solid rgba(255,255,255,.3)`, borderTopColor: '#fff', borderRightColor: '#fff', animation: 'pmSpin 1s linear infinite' }} />
        ) : a.ring === 'pulse' ? (
          <>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${bw}px solid rgba(255,255,255,.55)` }} />
            <span className="pm-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${bw}px solid #fff`, animation: 'pmPulse 1.2s ease-out infinite' }} />
          </>
        ) : (
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${a.ringColor ? bw * 1.6 : bw}px solid ${a.ringColor ?? 'rgba(255,255,255,.55)'}` }} />
        )
      )}
      {dot && (
        <span style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: '50%', background: DOT[dot], border: `${Math.max(2, size * 0.05)}px solid #fff`, boxSizing: 'border-box' }} />
      )}
    </span>
  );
}
