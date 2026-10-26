'use client';
// Full-body mascot for screens (empty states, errors, sign-in, onboarding...)
import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { SCENES, SceneDef, SceneName } from '../core/scenes';
import type { MascotInstance } from './store';
import { useMascotRuntime } from './MascotProvider';

export interface MascotProps {
  /** a built-in scene (see SCENE_NAMES) */
  scene?: SceneName;
  /** or a custom scene (wins over `scene`) */
  def?: SceneDef;
  /** size in CSS px, square */
  size?: number;
  /** the robot looks at the pointer */
  follow?: boolean;
  /** frame cap for this mascot */
  fps?: number;
  /** shown until the 3D robot has drawn its first frame (and forever without WebGL) */
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** screen-reader label; without it the mascot is decorative (aria-hidden) */
  label?: string;
  /** never download the 3D runtime for this mascot; show the robot only if it is already loaded */
  passive?: boolean;
}

export function Mascot({ scene = 'welcome', def, size = 240, follow = true, fps, fallback, className, style, label, passive = false }: MascotProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const store = useMascotRuntime(ref, passive);
  const inst = useRef<MascotInstance | null>(null);
  const [ready, setReady] = useState(false);
  const defKey = def ? JSON.stringify(def) : scene;
  const resolved = useMemo<SceneDef>(() => def ?? SCENES[scene] ?? SCENES.welcome, [defKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    if (!store || !el) return;
    const onReady = () => setReady(true);
    el.addEventListener('mascotready', onReady);
    const i = store.register({ kind: 'body', el, size, def: resolved, follow, fps });
    inst.current = i;
    return () => { el.removeEventListener('mascotready', onReady); store.unregister(i); inst.current = null; };
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const i = inst.current; if (i && i.state.def !== resolved) store?.setDef(i, resolved); }, [store, resolved]);
  useEffect(() => { const i = inst.current; if (i && i.size !== size) store?.resize(i, size); }, [store, size]);
  useEffect(() => { if (inst.current) inst.current.follow = follow; }, [follow]);
  useEffect(() => { const i = inst.current; if (i) store?.setFps(i, fps); }, [store, fps]);

  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span {...a11y} className={className} style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: 'none', ...style }}>
      {!ready && fallback && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{fallback}</span>}
      <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: size, height: size, opacity: 0, transition: 'opacity .35s ease-out' }} />
    </span>
  );
}
