import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Scene 3: By the numbers — 4 big animated counters
const STATS = [
  { value: 110, label: 'Issues closed', suffix: '' },
  { value: 97, label: 'PRs merged', suffix: '' },
  { value: 739, label: 'Commits', suffix: '' },
  { value: 60, label: 'Time-to-site', suffix: 's', prefix: '<' },
];

export const SceneNumbers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(236,72,153,0.22), transparent 60%), #0b0d10',
        color: '#e6edf3',
        fontFamily: 'Be Vietnam Pro, Inter, sans-serif',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 100px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 100, opacity: headerProgress }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#ec4899',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Con số
        </div>
        <h2
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 84,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.03em',
          }}
        >
          Sprint 1-3 đã làm được gì
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 40,
          maxWidth: 1600,
          width: '100%',
        }}
      >
        {STATS.map((stat, i) => {
          const enterDelay = 10 + i * 15;
          const enter = spring({
            frame: frame - enterDelay,
            fps,
            config: { damping: 14, stiffness: 160 },
          });
          const countProgress = interpolate(
            frame - enterDelay - 10,
            [0, 60],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          const displayVal = Math.round(stat.value * countProgress);
          return (
            <div
              key={stat.label}
              style={{
                textAlign: 'center',
                opacity: enter,
                transform: `translateY(${(1 - enter) * 30}px) scale(${0.9 + enter * 0.1})`,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 24,
                padding: '48px 24px',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 140,
                  fontWeight: 800,
                  lineHeight: 1,
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  letterSpacing: '-0.04em',
                }}
              >
                {stat.prefix ?? ''}
                {displayVal}
                <span style={{ fontSize: 72 }}>{stat.suffix}</span>
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 24,
                  color: '#8b949e',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 80,
          fontSize: 28,
          color: '#6b7280',
          opacity: interpolate(frame, [140, 180], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        12 thành viên · 3 ngôn ngữ (VI / EN / MS) · &minus;97% prod error rate
      </div>
    </AbsoluteFill>
  );
};
