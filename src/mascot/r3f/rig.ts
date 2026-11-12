// Nhân bản model GLB cho mỗi mascot và gắn tư thế (Pose) từ core lên các node.
import * as THREE from 'three';
import type { Pose } from '../core/state';
import { ANIMATED_EXPR, paintFaceCanvas } from '../core/face';
import type { Expression } from '../core/scenes';

const NODE_NAMES = ['Body', 'Head', 'Shoulder_L', 'Elbow_L', 'Shoulder_R', 'Elbow_R', 'Screen'] as const;

/* ---------- tài nguyên dùng chung (tạo một lần) ---------- */
let SHARED: { flameTex: THREE.Texture; shadowTex: THREE.Texture; plane: THREE.PlaneGeometry } | null = null;
function shared() {
  if (SHARED) return SHARED;
  const flame = document.createElement('canvas'); flame.width = 64; flame.height = 128;
  const fx = flame.getContext('2d')!;
  const g = fx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(140,236,246,.85)'); g.addColorStop(1, 'rgba(0,181,207,0)');
  fx.fillStyle = g; fx.beginPath(); fx.moveTo(14, 0); fx.quadraticCurveTo(32, 190, 50, 0); fx.closePath(); fx.fill();
  const sh = document.createElement('canvas'); sh.width = sh.height = 128;
  const sx = sh.getContext('2d')!, rg = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(30,50,90,.32)'); rg.addColorStop(1, 'rgba(30,50,90,0)');
  sx.fillStyle = rg; sx.fillRect(0, 0, 128, 128);
  const flameTex = new THREE.CanvasTexture(flame), shadowTex = new THREE.CanvasTexture(sh);
  flameTex.colorSpace = shadowTex.colorSpace = THREE.SRGBColorSpace;
  SHARED = { flameTex, shadowTex, plane: new THREE.PlaneGeometry(1, 1) };
  return SHARED;
}

export interface Rig {
  root: THREE.Object3D;
  apply(pose: Pose): void;
  dispose(): void;
}

/**
 * Face texture width for a mascot drawn at `devicePx` (CSS size × DPR): the screen covers ~45% of a
 * full-body frame and ~75% of an avatar. Power of two, 2× the on-screen pixels so the strokes stay
 * sharp after the head turns and the texture is minified.
 */
export function faceResolution(kind: 'body' | 'avatar', devicePx: number) {
  const screenPx = devicePx * (kind === 'avatar' ? 0.75 : 0.45) * 2;
  // 512 cap: past that the glow repaint costs more than the screen can show
  return Math.min(512, Math.max(192, 2 ** Math.ceil(Math.log2(screenPx))));
}

/** Tạo bản sao model cho một mascot. kind = 'avatar' sẽ ẩn bóng nền và lửa đẩy. */
export function createRig(source: THREE.Object3D, kind: 'body' | 'avatar', faceRes = kind === 'avatar' ? 256 : 512, anisotropy = 4): Rig {
  const root = source.clone(true);
  const n = {} as Record<(typeof NODE_NAMES)[number], THREE.Object3D>;
  for (const name of NODE_NAMES) {
    const o = root.getObjectByName(name);
    if (!o) throw new Error(`[mascot] model thiếu node "${name}"`);
    n[name] = o;
  }
  // màn hình: vật liệu riêng + texture mặt riêng cho từng mascot
  const screen = n.Screen as THREE.Mesh;
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceRes; faceCanvas.height = faceRes * 0.75;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.flipY = false; // UV theo quy ước glTF
  // premultiplied, like the demo's UNPACK_PREMULTIPLY_ALPHA: keeps the glow's soft edges soft
  faceTex.premultiplyAlpha = true;
  faceTex.wrapS = faceTex.wrapT = THREE.ClampToEdgeWrapping;
  faceTex.anisotropy = anisotropy;
  const mat = (screen.material as THREE.MeshPhysicalMaterial).clone();
  // the demo adds the face at 1.1× on top of the screen; tone mapping eats a little, so 1.25 here
  mat.emissive = new THREE.Color('#ffffff'); mat.emissiveMap = faceTex; mat.emissiveIntensity = 1.25;
  screen.material = mat;

  const S = shared(), extras: THREE.Object3D[] = [];
  if (kind === 'body') {
    const flame = new THREE.Mesh(S.plane, new THREE.MeshBasicMaterial({ map: S.flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    flame.scale.set(0.2, 0.42, 1); flame.position.set(0, -1.73, 0); flame.renderOrder = -1;
    n.Body.add(flame); extras.push(flame);
    const blob = new THREE.Mesh(S.plane, new THREE.MeshBasicMaterial({ map: S.shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(0, -1.86, 0); blob.scale.set(1.7, 1.7, 1); blob.renderOrder = -2;
    root.add(blob); extras.push(blob);
  }
  let faceKey = '';
  const shadowBase = 1.7;

  return {
    root,
    apply(p: Pose) {
      root.position.y = p.bob;
      n.Body.quaternion.set(p.body[0], p.body[1], p.body[2], p.body[3]);
      n.Head.quaternion.set(p.head[0], p.head[1], p.head[2], p.head[3]);
      n.Shoulder_L.quaternion.set(...p.L.shoulder); n.Elbow_L.quaternion.set(...p.L.elbow);
      n.Shoulder_R.quaternion.set(...p.R.shoulder); n.Elbow_R.quaternion.set(...p.R.elbow);
      // face: repainted only when the expression or blink changes; animated expressions (speaking,
      // typing, thinking...) at 30 fps — smooth to the eye, and it bounds the shadowBlur repaint cost
      const lvl = Math.round(p.blink * 10) / 10;
      const key = p.expr + '|' + lvl + (ANIMATED_EXPR[p.expr as Expression] ? '|' + Math.floor(p.t * 30) : '');
      if (key !== faceKey) { paintFaceCanvas(faceCanvas, p.expr, p.t, lvl); faceTex.needsUpdate = true; faceKey = key; }
      faceTex.offset.set(-p.eye[0], -p.eye[1]);
      if (extras.length) {
        const flame = extras[0], blob = extras[1];
        flame.scale.y = 0.42 + Math.sin(p.t * 22) * 0.06 + Math.sin(p.t * 37) * 0.03;
        const k = shadowBase * (1 - p.bob * 1.6);
        blob.position.y = -1.86 - p.bob; blob.scale.set(k, k, 1);
      }
    },
    dispose() {
      faceTex.dispose(); mat.dispose();
      extras.forEach((e) => ((e as THREE.Mesh).material as THREE.Material).dispose());
    }
  };
}
