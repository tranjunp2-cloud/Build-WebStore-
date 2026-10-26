'use client';
// The heavy half of the mascot: three + R3F + drei + the GLB. Loaded on idle by <MascotProvider>
// (never in the first-paint bundle). One hidden R3F canvas renders every mascot on the page.
import * as THREE from 'three';
import { Fragment, Suspense, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MascotInstance, MascotStore } from './store';
import { createRig, faceResolution } from './rig';
import { SceneExtras } from './SceneExtras';

export { MascotStore };

const RES = 1024; // max size (device px) of one mascot

function useDef(inst: MascotInstance) {
  return useSyncExternalStore(
    (fn) => { inst.defListeners.add(fn); return () => { inst.defListeners.delete(fn); }; },
    () => inst.state.def, () => inst.state.def
  );
}

function InstanceContent({ inst, model, env }: { inst: MascotInstance; model: THREE.Object3D; env: THREE.Texture }) {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  // face resolution is fixed at creation from the size the mascot was mounted with
  const rig = useMemo(() => createRig(model, inst.kind, faceResolution(inst.kind, inst.size * inst.dpr), Math.min(8, maxAniso)), [model, inst, maxAniso]);
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    let live = true;
    inst.scene.environment = env;
    (inst.scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.6;
    // compile shaders off the main thread first (KHR_parallel_shader_compile): the first draw used to
    // stall the page ~150ms; the mascot shows once its programs are ready
    const ready = () => { if (live) { inst.rig = rig; inst.dirty = true; } };
    gl.compileAsync(inst.scene, inst.camera).then(ready, ready);
    return () => { live = false; if (inst.rig === rig) inst.rig = null; rig.dispose(); };
  }, [rig, env, inst, gl]);
  const def = useDef(inst);
  return (
    <>
      <hemisphereLight args={['#ffffff', '#8ea4c6', 1.15]} />
      <directionalLight position={[-4, 6, 6]} intensity={2.3} />
      <directionalLight position={[5, 2, -4]} intensity={1.5} color="#9ff3ff" />
      <primitive object={rig.root} />
      {inst.kind === 'body' && <SceneExtras inst={inst} def={def} />}
    </>
  );
}

function World({ store, modelUrl }: { store: MascotStore; modelUrl: string }) {
  const { scene: model } = useGLTF(modelUrl);
  const gl = useThree((s) => s.gl);
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return tex;
  }, [gl]);
  const ids = useSyncExternalStore(store.subscribe, store.getIds, store.getIds);
  // priority 1: we render each mascot ourselves, R3F no longer renders the default scene
  useFrame(() => store.renderAll(gl), 1);
  return (
    <>
      {ids.map((id) => {
        const inst = store.get(id);
        return inst ? <Fragment key={id}>{createPortal(<InstanceContent inst={inst} model={model} env={env} />, inst.scene)}</Fragment> : null;
      })}
    </>
  );
}

export function MascotCanvas({ store, modelUrl }: { store: MascotStore; modelUrl: string }) {
  return (
    <div aria-hidden style={{ position: 'fixed', left: -RES - 200, top: 0, width: RES, height: RES, pointerEvents: 'none' }}>
      <Canvas
        dpr={1}
        frameloop="always"
        style={{ width: RES, height: RES }}
        // no preserveDrawingBuffer: each mascot is copied out in the same task it is rendered, so the
        // buffer is still intact, and skipping the preserve copy saves a full-canvas blit per frame
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = (THREE as unknown as { NeutralToneMapping?: THREE.ToneMapping }).NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Suspense fallback={null}>
          <World store={store} modelUrl={modelUrl} />
        </Suspense>
      </Canvas>
    </div>
  );
}
