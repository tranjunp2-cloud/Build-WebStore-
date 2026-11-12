'use client';
// Đạo cụ, vật cầm trên tay và hiệu ứng nền của một scene (dựng bằng R3F + drei trong portal của mascot)
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { Sparkles } from '@react-three/drei';
import { LAYOUT, PropName, SceneDef, layoutToWorld } from '../core/scenes';
import { PROP_ANIM, PROP_EXTENT, paintPropCanvas } from '../core/props';
import type { FrameFn, MascotInstance } from './store';

const K = PROP_EXTENT / LAYOUT.pxPerUnit; // kích thước thế giới của khung sprite khi s = 1
const TEX = new Map<string, THREE.Texture>();
function propTexture(name: PropName) {
  let t = TEX.get(name);
  if (!t) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    paintPropCanvas(c, name, 0);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    TEX.set(name, t);
  }
  return t;
}
const PLANE = new THREE.PlaneGeometry(1, 1);
const CIRCLE = new THREE.CircleGeometry(1, 20);

function useFrameFn(inst: MascotInstance, fn: FrameFn) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    const f: FrameFn = (i, dt) => ref.current(i, dt);
    inst.onFrame.add(f);
    return () => { inst.onFrame.delete(f); };
  }, [inst]);
}

/* ---------- phần chuyển động bên trong đạo cụ, dựng bằng hình 3D (không vẽ lại texture) ---------- */
function LiveParts({ inst, name, phase }: { inst: MascotInstance; name: PropName; phase: number }) {
  const g = useRef<THREE.Group>(null);
  const u = 1 / PROP_EXTENT; // 1 đơn vị vẽ 2D trong hệ toạ độ sprite
  const teal = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00b5cf', toneMapped: false }), []);
  const yellows = useMemo(() => [0, 1].map(() => new THREE.MeshBasicMaterial({ color: '#ffc233', transparent: true, toneMapped: false, depthWrite: false })), []);
  const rings = useMemo(() => [0, 1].map((i) => new THREE.RingGeometry((20 + i * 13 - 2.25) * u, (20 + i * 13 + 2.25) * u, 24, 1, -0.7, 1.4)), [u]);
  const arc = useMemo(() => new THREE.RingGeometry(24 * u, 34 * u, 40, 1, 0, Math.PI * 1.1), [u]);
  useFrameFn(inst, (it) => {
    const grp = g.current; if (!grp) return;
    const t = it.state.t + phase;
    if (name === 'chat') grp.children.forEach((c, i) => { c.position.y = (5 + Math.max(0, Math.sin(t * 6 - i)) * 6) * u; });
    if (name === 'megaphone') grp.children.forEach((c, i) => { ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.5 * Math.sin(t * 6 - i); });
    if (name === 'spinner') grp.rotation.z = -t * 5;
  });
  if (name === 'chat') return (
    <group ref={g} position={[0, 0, 0.002]}>
      {[0, 1, 2].map((i) => <mesh key={i} geometry={CIRCLE} material={teal} position={[(-17 + i * 17) * u, 5 * u, 0]} scale={5.5 * u} />)}
    </group>
  );
  if (name === 'megaphone') return (
    <group ref={g} position={[16 * u, 0, 0.002]}>
      {rings.map((r, i) => <mesh key={i} geometry={r} material={yellows[i]} />)}
    </group>
  );
  if (name === 'spinner') return <group ref={g} position={[0, 0, 0.002]}><mesh geometry={arc} material={teal} /></group>;
  return null;
}

function PropSprite({ inst, name, at, s = 1, phase }: { inst: MascotInstance; name: PropName; at: [number, number]; s?: number; phase: number }) {
  const g = useRef<THREE.Group>(null), m = useRef<THREE.Mesh>(null);
  const [x, y, z] = layoutToWorld(at[0], at[1]);
  const tex = useMemo(() => propTexture(name), [name]);
  useFrameFn(inst, (it) => {
    const t = it.state.t + phase;
    if (g.current) g.current.position.y = y + (Math.sin(t * 2) * 4) / LAYOUT.pxPerUnit;
    const a = PROP_ANIM[name]?.(t), mesh = m.current;
    if (mesh && a) {
      mesh.rotation.z = -(a.r ?? 0);
      mesh.scale.set((a.s ?? 1) * (a.sx ?? 1), a.s ?? 1, 1);
      mesh.position.x = (a.dx ?? 0) / PROP_EXTENT;
    }
  });
  return (
    <group ref={g} position={[x, y, z]} scale={K * s}>
      <mesh ref={m} geometry={PLANE} renderOrder={2}>
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <LiveParts inst={inst} name={name} phase={phase} />
    </group>
  );
}

function HeldProp({ inst, side, name, scale = 0.8 }: { inst: MascotInstance; side: 'L' | 'R'; name: PropName; scale?: number }) {
  const g = useRef<THREE.Group>(null);
  const tex = useMemo(() => propTexture(name), [name]);
  useFrameFn(inst, (it) => {
    if (!g.current) return;
    const h = it.pose?.[side].hand; if (!h) return;
    g.current.position.set(h[0], h[1] + 0.3, h[2] + 0.18);
  });
  return (
    <group ref={g} scale={K * scale}>
      <mesh geometry={PLANE} renderOrder={3}><meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} /></mesh>
      <LiveParts inst={inst} name={name} phase={0} />
    </group>
  );
}

const CONF_COLORS = ['#00b5cf', '#ff9f43', '#ffc233', '#2ecc8f', '#ff5d6c', '#1d3f94'];
function Confetti({ inst, count = 26 }: { inst: MascotInstance; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: ((i * 59) % 352) / 89.3 - 1.97, off: (i * 41) % 340, rot: i * 1.7, sp: 0.9 + ((i * 7) % 5) * 0.08 })), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    seeds.forEach((_, i) => m.setColorAt(i, new THREE.Color(CONF_COLORS[i % 6])));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [seeds]);
  useFrameFn(inst, (it) => {
    const m = ref.current; if (!m) return;
    const t = it.state.t;
    seeds.forEach((s, i) => {
      const py = ((t * 55 * s.sp + s.off) % 340) + 10;
      dummy.position.set(s.x, LAYOUT.centerY + (200 - py) / LAYOUT.pxPerUnit, 0.6 + (i % 3) * 0.1);
      dummy.rotation.set(t * 2 + s.rot, t * 3 + s.rot, t * 1.3);
      dummy.scale.set(i % 3 ? 0.11 : 0.08, i % 3 ? 0.055 : 0.08, 1);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[PLANE, undefined, count]}>
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

export function SceneExtras({ inst, def }: { inst: MascotInstance; def: SceneDef }) {
  return (
    <>
      {(def.props ?? []).map((p, i) => <PropSprite key={p.n + i} inst={inst} name={p.n} at={p.at} s={p.s} phase={i * 0.65} />)}
      {def.hold?.L && <HeldProp inst={inst} side="L" name={def.hold.L} scale={def.holdScale} />}
      {def.hold?.R && <HeldProp inst={inst} side="R" name={def.hold.R} scale={def.holdScale} />}
      {def.fx === 'sparkle' && <Sparkles count={18} scale={[4.4, 3.8, 1]} position={[0, 0.55, 0.3]} size={5} speed={0.45} opacity={0.9} color="#bff6ff" noise={0.6} />}
      {def.fx === 'confetti' && <Confetti inst={inst} />}
    </>
  );
}
