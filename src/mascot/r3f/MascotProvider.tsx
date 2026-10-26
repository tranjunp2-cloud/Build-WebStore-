'use client';
// Wrap a layout ONCE. The 3D runtime (three + R3F + GLB) is imported on idle, after the page has
// painted. Until then — or forever on devices without WebGL / with Save-Data — every <Mascot> and
// <MascotAvatar> shows its fallback, so no screen waits on the mascot.
import { ComponentType, ReactNode, createContext, useContext, useEffect, useState } from 'react';
import type { MascotStore } from './store';

export const DEFAULT_MODEL_URL = '/models/webstore-bot.glb';

const MascotContext = createContext<MascotStore | null>(null);
const ProviderMounted = createContext(false);

/** null until the 3D runtime is ready (and stays null when the device can't run it) */
export function useMascotStore() {
  return useContext(MascotContext);
}

/** Performance numbers (fps, visible mascots, load-shedding stride) — zeros before the runtime loads */
export function useMascotStats(intervalMs = 500) {
  const store = useMascotStore();
  const empty = { fps: 0, visible: 0, total: 0, stride: 1, msPerMascot: 0 };
  const [s, set] = useState(store ? { ...store.stats } : empty);
  useEffect(() => {
    if (!store) return;
    const id = setInterval(() => set({ ...store.stats }), intervalMs);
    return () => clearInterval(id);
  }, [store, intervalMs]);
  return s;
}

function canRender3D() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

type Runtime = { store: MascotStore; Canvas: ComponentType<{ store: MascotStore; modelUrl: string }> };

export interface MascotProviderProps {
  children: ReactNode;
  /** GLB path (default /models/webstore-bot.glb in public/) */
  modelUrl?: string;
}

export function MascotProvider({ children, modelUrl = DEFAULT_MODEL_URL }: MascotProviderProps) {
  const nested = useContext(ProviderMounted);
  const [rt, setRt] = useState<Runtime | null>(null);

  useEffect(() => {
    if (nested || !canRender3D()) return;
    let cancelled = false;
    const load = () => {
      import('./MascotRenderer')
        .then((m) => {
          if (cancelled) return;
          const store = new m.MascotStore();
          // localStorage['mascot:debug'] = '1' → window.__mascot.stats (fps, visible, ms per mascot)
          try { if (localStorage.getItem('mascot:debug')) (window as Window & { __mascot?: MascotStore }).__mascot = store; } catch { /* storage blocked */ }
          setRt({ store, Canvas: m.MascotCanvas });
        })
        .catch(() => { /* no mascot runtime: fallbacks stay */ });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(load, { timeout: 2500 });
      return () => { cancelled = true; w.cancelIdleCallback?.(id); };
    }
    const t = window.setTimeout(load, 800);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [nested]);

  if (nested) return <>{children}</>;
  return (
    <ProviderMounted.Provider value>
      <MascotContext.Provider value={rt?.store ?? null}>
        {children}
        {rt && <rt.Canvas store={rt.store} modelUrl={modelUrl} />}
      </MascotContext.Provider>
    </ProviderMounted.Provider>
  );
}
