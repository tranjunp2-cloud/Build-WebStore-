import { AbsoluteFill, Sequence } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadBeVietnam } from '@remotion/google-fonts/BeVietnamPro';
import { SceneHero } from './scenes/scene-hero';
import { SceneFeatures } from './scenes/scene-features';
import { SceneNumbers } from './scenes/scene-numbers';
import { SceneOutro } from './scenes/scene-outro';

loadInter();
loadSpaceGrotesk();
loadBeVietnam();

// 30s @ 30fps = 900 frames, split across 4 scenes
const SCENE_HERO_FRAMES = 210;       // 0-7s
const SCENE_FEATURES_FRAMES = 240;   // 7-15s
const SCENE_NUMBERS_FRAMES = 210;    // 15-22s
const SCENE_OUTRO_FRAMES = 240;      // 22-30s

export const Phase1Release: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d10' }}>
      <Sequence from={0} durationInFrames={SCENE_HERO_FRAMES}>
        <SceneHero />
      </Sequence>
      <Sequence from={SCENE_HERO_FRAMES} durationInFrames={SCENE_FEATURES_FRAMES}>
        <SceneFeatures />
      </Sequence>
      <Sequence
        from={SCENE_HERO_FRAMES + SCENE_FEATURES_FRAMES}
        durationInFrames={SCENE_NUMBERS_FRAMES}
      >
        <SceneNumbers />
      </Sequence>
      <Sequence
        from={SCENE_HERO_FRAMES + SCENE_FEATURES_FRAMES + SCENE_NUMBERS_FRAMES}
        durationInFrames={SCENE_OUTRO_FRAMES}
      >
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
