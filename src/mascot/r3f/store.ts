// Sổ đăng ký mascot + vòng render chung: một WebGL context vẽ lần lượt từng mascot
// rồi chép sang <canvas> 2D của chính nó (giữ đúng z-index, bo tròn CSS, cắt theo vùng cuộn).
import * as THREE from 'three';
import { MascotState, Pose } from '../core/state';
import { CAMERA, SceneDef } from '../core/scenes';
import { followTarget } from '../core/pointer';
import { clamp } from '../core/math';
import type { Rig } from './rig';

export type MascotKind = 'body' | 'avatar';
export type FrameFn = (inst: MascotInstance, dt: number) => void;

export interface MascotInstance {
  id: number;
  kind: MascotKind;
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size: number;
  dpr: number;
  follow: boolean;
  state: MascotState;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rig: Rig | null;
  /** tư thế của khung hiện tại (đã tính) */
  pose: Pose | null;
  /** cập nhật thêm mỗi khung (đạo cụ, hiệu ứng) – đăng ký từ JSX */
  onFrame: Set<FrameFn>;
  visible: boolean;
  last: number;
  minDt: number;
  dirty: boolean;
  /** first frame drawn: the canvas fades in (it starts at opacity 0 over the fallback) */
  shown: boolean;
  defListeners: Set<() => void>;
}

export interface RegisterOptions { kind: MascotKind; el: HTMLCanvasElement; size: number; def: SceneDef; follow?: boolean; fps?: number; maxDpr?: number }

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const now = () => performance.now();

export class MascotStore {
  private map = new Map<number, MascotInstance>();
  private ids: number[] = [];
  private listeners = new Set<() => void>();
  private uid = 1;
  private io: IntersectionObserver | null = null;
  private frameNo = 0;
  private stride = 1;
  private avgCost = 0.6;
  private gap = 16.7;
  private load = 1;
  private lastTs = 0;
  readonly stats = { fps: 0, visible: 0, total: 0, stride: 1, msPerMascot: 0 };
  private fpsFrames = 0;
  private fpsT0 = 0;
  readonly reduced = reducedMotion();

  /* ---- external store cho React ---- */
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getIds = () => this.ids;
  get(id: number) { return this.map.get(id); }
  private emit() { this.ids = [...this.map.keys()]; this.listeners.forEach((f) => f()); }

  register(o: RegisterOptions): MascotInstance {
    const dpr = Math.min(o.maxDpr ?? 2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const cam = o.kind === 'avatar' ? CAMERA.avatar : CAMERA.body;
    const camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.5, 60);
    camera.position.set(...cam.position); camera.lookAt(new THREE.Vector3(...cam.target)); camera.updateMatrixWorld();
    const inst: MascotInstance = {
      id: this.uid++, kind: o.kind, el: o.el, ctx: o.el.getContext('2d')!, size: o.size, dpr,
      follow: !!o.follow, state: new MascotState(o.def), scene: new THREE.Scene(), camera, rig: null, pose: null,
      onFrame: new Set(), visible: true, last: -1, minDt: 0,
      dirty: true, shown: false, defListeners: new Set()
    };
    this.resize(inst, o.size);
    this.setFps(inst, o.fps);
    this.map.set(inst.id, inst);
    if (typeof IntersectionObserver !== 'undefined') {
      this.io ??= new IntersectionObserver((es) => es.forEach((e) => {
        for (const it of this.map.values()) if (it.el === e.target) { it.visible = e.isIntersecting; it.dirty = true; }
      }), { rootMargin: '120px' });
      this.io.observe(o.el);
    }
    this.emit();
    return inst;
  }
  unregister(inst: MascotInstance) {
    this.io?.unobserve(inst.el);
    inst.rig?.dispose();
    this.map.delete(inst.id);
    this.emit();
  }
  resize(inst: MascotInstance, size: number) {
    inst.size = size;
    inst.el.width = Math.round(size * inst.dpr); inst.el.height = Math.round(size * inst.dpr);
    inst.el.style.width = size + 'px'; inst.el.style.height = size + 'px';
    inst.dirty = true;
  }
  /** frame cap; small avatars default to 30 fps, everything else to 60 */
  setFps(inst: MascotInstance, fps?: number) {
    inst.minDt = 1000 / (fps ?? (inst.kind === 'avatar' && inst.size <= 48 ? 30 : 60));
  }
  setDef(inst: MascotInstance, def: SceneDef) {
    inst.state.setDef(def); inst.dirty = true;
    inst.defListeners.forEach((f) => f());
  }

  /** gọi trong useFrame (priority 1) – tự render, R3F không render cảnh mặc định */
  renderAll(gl: THREE.WebGLRenderer) {
    const ts = now(); this.frameNo++;
    const glCanvas = gl.domElement, H = glCanvas.height, maxPw = Math.min(glCanvas.width, H);
    let n = 0, vis = 0;
    const t0 = now();
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setClearColor(0x000000, 0);
    for (const it of this.map.values()) {
      if (!it.rig || !it.visible) continue;
      vis++;
      const animate = !this.reduced;
      if (!animate && !it.dirty) continue;
      if (animate && ts - it.last < it.minDt - 1.5) continue;
      if (animate && this.stride > 1 && (this.frameNo + it.id) % this.stride) continue;
      const dt = it.last < 0 || !animate ? 0 : clamp((ts - it.last) / 1000, 0, 0.05);
      it.last = ts;
      // cập nhật trạng thái + tư thế
      const fol = it.follow && animate ? followTarget(it.el, it.kind === 'avatar' ? 0.45 : 0.32) : null;
      it.state.step(dt, fol);
      it.pose = it.state.pose(it.kind === 'avatar');
      it.rig.apply(it.pose);
      it.onFrame.forEach((f) => f(it, dt));
      // render vào góc dưới-trái của canvas WebGL rồi chép sang canvas của mascot
      const pw = Math.min(it.el.width, maxPw);
      gl.setViewport(0, 0, pw, pw); gl.setScissor(0, 0, pw, pw);
      gl.clear(true, true, true);
      gl.render(it.scene, it.camera);
      it.ctx.setTransform(1, 0, 0, 1, 0, 0);
      it.ctx.clearRect(0, 0, it.el.width, it.el.height);
      it.ctx.drawImage(glCanvas, 0, H - pw, pw, pw, 0, 0, it.el.width, it.el.height);
      it.dirty = false;
      if (!it.shown) { it.shown = true; it.el.style.opacity = '1'; it.el.dispatchEvent(new Event('mascotready')); }
      n++;
    }
    gl.setScissorTest(false);
    // giảm tải thích ứng: theo thời gian CPU và nhịp khung thực tế (bao gồm GPU)
    if (n) this.avgCost = this.avgCost * 0.9 + ((now() - t0) / n) * 0.1;
    const gap = ts - this.lastTs; this.lastTs = ts;
    if (gap > 0 && gap < 500) this.gap = this.gap * 0.92 + gap * 0.08;
    if (this.gap > 26 && vis > 2) this.load = Math.min(4, this.load + 0.02); else if (this.gap < 19) this.load = Math.max(1, this.load - 0.01);
    this.stride = clamp(Math.max(Math.ceil((this.avgCost * vis) / 10), Math.round(this.load)), 1, 4);
    this.fpsFrames++;
    if (ts - this.fpsT0 > 500) { this.stats.fps = Math.round((this.fpsFrames * 1000) / (ts - this.fpsT0)); this.fpsFrames = 0; this.fpsT0 = ts; }
    this.stats.visible = vis; this.stats.total = this.map.size; this.stats.stride = this.stride; this.stats.msPerMascot = +this.avgCost.toFixed(2);
  }
}
