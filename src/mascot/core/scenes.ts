// Cấu hình scene theo màn hình và trạng thái avatar
export type Expression =
  | 'open' | 'happy' | 'wink' | 'wow' | 'sad' | 'think' | 'sleepy' | 'love' | 'focus' | 'error'
  | 'typing' | 'speaking' | 'listening' | 'blank';

export type PropName =
  | 'chart' | 'box' | 'cart' | 'card' | 'bell' | 'gear' | 'magnifier' | 'truck' | 'chat' | 'tag' | 'warning'
  | 'check' | 'lock' | 'shield' | 'star' | 'heart' | 'megaphone' | 'users' | 'clipboard' | 'cloud' | 'cloudOff'
  | 'dollar' | 'spinner' | 'n404' | 'question' | 'wrench';

/** Tay: số = góc nâng (độ; 0 thả xuống, 90 ngang vai, 180 giơ thẳng) hoặc object chi tiết */
export type ArmSpec = number | { a: number; fwd?: number; sway?: boolean; wave?: boolean };

export interface PropSpec {
  n: PropName;
  /** vị trí trong khung bố cục 400x400 (gốc trên-trái), giữ tương thích bản canvas */
  at: [number, number];
  s?: number;
}

export interface SceneDef {
  expr: Expression;
  armL?: ArmSpec;
  armR?: ArmSpec;
  /** hướng nhìn mặc định [yaw, pitch] (radian). yaw + là quay sang phải màn hình, pitch + là cúi xuống */
  look?: [number, number];
  props?: PropSpec[];
  hold?: { L?: PropName; R?: PropName };
  holdScale?: number;
  fx?: 'sparkle' | 'confetti';
}

const L: [number, number] = [62, 208], R: [number, number] = [338, 208];

export const SCENES = {
  welcome:       { expr: 'wink', armL: 12, armR: { a: 150, wave: true }, fx: 'sparkle', look: [0.14, -0.04] },
  login:         { expr: 'open', armL: 12, armR: { a: 150, wave: true }, props: [{ n: 'lock', at: L }], look: [-0.25, 0] },
  onboarding:    { expr: 'happy', armL: { a: 96, fwd: 0.5 }, armR: { a: 96, fwd: 0.5 }, fx: 'sparkle', props: [{ n: 'star', at: [350, 96], s: 0.6 }] },
  dashboard:     { expr: 'happy', armL: 12, armR: { a: 100, sway: true, fwd: 0.45 }, props: [{ n: 'chart', at: R, s: 1.1 }], look: [0.28, 0] },
  products:      { expr: 'open', armL: 12, armR: { a: 128, fwd: 0.5 }, hold: { R: 'box' }, props: [{ n: 'tag', at: L }], look: [-0.2, 0] },
  orders:        { expr: 'focus', armL: 12, armR: { a: 130, fwd: 0.5 }, hold: { R: 'clipboard' }, props: [{ n: 'box', at: L, s: 0.95 }], look: [-0.18, 0.06] },
  customers:     { expr: 'happy', armL: { a: 98, sway: true, fwd: 0.6 }, armR: { a: 98, sway: true, fwd: 0.6 }, props: [{ n: 'users', at: [346, 92], s: 0.62 }, { n: 'heart', at: [54, 96], s: 0.55 }] },
  inventory:     { expr: 'focus', armL: 12, armR: { a: 128, fwd: 0.5 }, hold: { R: 'clipboard' }, props: [{ n: 'box', at: [60, 262], s: 0.9 }, { n: 'box', at: [58, 200], s: 0.75 }] },
  shipping:      { expr: 'happy', armL: 12, armR: { a: 100, fwd: 0.45 }, props: [{ n: 'truck', at: [332, 222], s: 1.0 }], look: [0.24, 0] },
  payment:       { expr: 'open', armL: 12, armR: { a: 130, fwd: 0.5 }, hold: { R: 'card' }, props: [{ n: 'dollar', at: L }], look: [-0.22, 0] },
  cart:          { expr: 'happy', armL: 12, armR: { a: 100, fwd: 0.45 }, props: [{ n: 'cart', at: [336, 218], s: 1.1 }], look: [0.24, 0] },
  analytics:     { expr: 'think', armL: 12, armR: { a: 138, fwd: 0.5 }, hold: { R: 'magnifier' }, props: [{ n: 'chart', at: L, s: 1.05 }], look: [-0.24, 0] },
  marketing:     { expr: 'wow', armL: 12, armR: { a: 130, fwd: 0.5 }, hold: { R: 'megaphone' }, fx: 'sparkle', props: [{ n: 'tag', at: L }], look: [-0.2, 0] },
  reviews:       { expr: 'love', armL: { a: 20, fwd: 0.6 }, armR: { a: 20, fwd: 0.6 }, props: [{ n: 'star', at: [340, 214] }, { n: 'star', at: [60, 224], s: 0.75 }, { n: 'heart', at: [346, 104], s: 0.5 }], look: [0, -0.05] },
  support:       { expr: 'happy', armL: 12, armR: { a: 140, wave: true }, props: [{ n: 'chat', at: [62, 196] }], look: [-0.24, 0] },
  aiAssistant:   { expr: 'speaking', armL: 12, armR: { a: 145, wave: true }, fx: 'sparkle', props: [{ n: 'chat', at: [62, 196] }], look: [-0.22, 0] },
  notifications: { expr: 'wow', armL: 12, armR: { a: 118, fwd: 0.45 }, props: [{ n: 'bell', at: [338, 212], s: 1.05 }], look: [0.24, 0] },
  settings:      { expr: 'focus', armL: 12, armR: { a: 100, fwd: 0.45 }, props: [{ n: 'gear', at: [338, 208], s: 1.0 }, { n: 'gear', at: [60, 240], s: 0.65 }], look: [0.24, 0] },
  security:      { expr: 'focus', armL: { a: 14, fwd: 0.6 }, armR: { a: 14, fwd: 0.6 }, props: [{ n: 'shield', at: [340, 212], s: 1.05 }, { n: 'lock', at: [58, 236], s: 0.7 }], look: [0.24, 0] },
  empty:         { expr: 'sad', armL: 6, armR: 6, props: [{ n: 'box', at: [336, 296], s: 0.9 }], look: [0.14, 0.16] },
  searchEmpty:   { expr: 'think', armL: 12, armR: { a: 138, fwd: 0.5 }, hold: { R: 'magnifier' }, props: [{ n: 'question', at: L }], look: [-0.24, 0.05] },
  notFound:      { expr: 'sad', armL: 6, armR: 6, props: [{ n: 'n404', at: [200, 32], s: 0.9 }], look: [0, 0.12] },
  error:         { expr: 'error', armL: 6, armR: 6, props: [{ n: 'warning', at: [338, 212] }], look: [0.16, 0.1] },
  offline:       { expr: 'sleepy', armL: 6, armR: 6, props: [{ n: 'cloudOff', at: [338, 212] }], look: [0.22, 0.1] },
  loading:       { expr: 'focus', armL: 12, armR: 12, props: [{ n: 'spinner', at: [338, 212] }], look: [0.24, 0.04] },
  success:       { expr: 'happy', armL: { a: 150, sway: true, fwd: 0.2 }, armR: { a: 150, sway: true, fwd: 0.2 }, fx: 'confetti', props: [{ n: 'check', at: [350, 98], s: 0.75 }], look: [0, -0.12] },
  maintenance:   { expr: 'focus', armL: 12, armR: { a: 125, fwd: 0.5 }, hold: { R: 'wrench' }, props: [{ n: 'gear', at: L, s: 1.0 }], look: [-0.18, 0.08] }
} satisfies Record<string, SceneDef>;

export type SceneName = keyof typeof SCENES;
export const SCENE_NAMES = Object.keys(SCENES) as SceneName[];

export interface AvatarDef { expr: Expression; ring?: 'spin' | 'pulse'; ringColor?: string }
export const AVATAR_STATES = {
  idle: { expr: 'open' },
  thinking: { expr: 'think', ring: 'spin' },
  typing: { expr: 'typing', ring: 'spin' },
  speaking: { expr: 'speaking', ring: 'pulse' },
  listening: { expr: 'listening', ring: 'pulse' },
  happy: { expr: 'happy' },
  // done / saved: the green ring carries the meaning at icon sizes (toasts)
  success: { expr: 'happy', ringColor: '#2ecc8f' },
  love: { expr: 'love' },
  wow: { expr: 'wow' },
  error: { expr: 'error', ringColor: '#ff5d6c' },
  sleeping: { expr: 'sleepy' }
} satisfies Record<string, AvatarDef>;
export type AvatarState = keyof typeof AVATAR_STATES;
export const AVATAR_STATE_NAMES = Object.keys(AVATAR_STATES) as AvatarState[];

export function avatarScene(state: AvatarState): SceneDef {
  const a: AvatarDef = AVATAR_STATES[state] ?? AVATAR_STATES.idle;
  return { expr: a.expr, armL: { a: 6, fwd: 0.1 }, armR: { a: 6, fwd: 0.1 }, look: [0, 0.02] };
}

/** Đổi toạ độ bố cục 400x400 sang toạ độ thế giới 3D (mặt phẳng z = 0) */
export const LAYOUT = { pxPerUnit: 89.3, centerY: 0.36 };
export function layoutToWorld(px: number, py: number, z = 0.35): [number, number, number] {
  return [(px - 200) / LAYOUT.pxPerUnit, LAYOUT.centerY + (200 - py) / LAYOUT.pxPerUnit, z];
}

/** Camera chuẩn (khớp với bố cục 400x400 của bản canvas) */
export const CAMERA = {
  body: { position: [0, 2.1, 14.5] as [number, number, number], target: [0, 0.36, 0] as [number, number, number], fov: 17.44 },
  avatar: { position: [0, 2.0, 9.5] as [number, number, number], target: [0, 0.86, 0] as [number, number, number], fov: 19.22 }
};
