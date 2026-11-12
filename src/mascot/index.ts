// Web Store 3D mascot (React Three Fiber). Only light modules here: three/R3F/GLB load on idle
// from r3f/MascotRenderer, so importing this barrel never adds three to a page's first bundle.
export { MascotProvider, useMascotStore, useMascotStats, DEFAULT_MODEL_URL } from './r3f/MascotProvider';
export type { MascotProviderProps } from './r3f/MascotProvider';
export { Mascot } from './r3f/Mascot';
export type { MascotProps } from './r3f/Mascot';
export { MascotAvatar } from './r3f/MascotAvatar';
export type { MascotAvatarProps } from './r3f/MascotAvatar';
export {
  SCENES, SCENE_NAMES, AVATAR_STATES, AVATAR_STATE_NAMES, avatarScene, CAMERA, layoutToWorld
} from './core/scenes';
export type { SceneDef, SceneName, AvatarState, Expression, PropName, ArmSpec, PropSpec } from './core/scenes';
