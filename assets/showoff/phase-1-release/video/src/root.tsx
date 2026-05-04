import { Composition } from 'remotion';
import { Phase1Release } from './phase-1-release';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="phase1-release"
      component={Phase1Release}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
