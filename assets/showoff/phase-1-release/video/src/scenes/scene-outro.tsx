import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Scene 4: Outro — Phase 2 teaser + CTA
const PHASE_2 = [
  { code: 'F13', name: 'Payment Gateway' },
  { code: 'F14', name: 'Shipping' },
  { code: 'F15', name: 'Admin Management' },
];

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const arrowProgress = spring({ frame, fps, config: { damping: 14 } });
  const headlineProgress = spring({ frame: frame - 20, fps, config: { damping: 16 } });
  const ctaProgress = spring({ frame: frame - 140, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at 30% 40%, rgba(139,92,246,0.3), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(6,182,212,0.25), transparent 60%), #0b0d10',
        color: '#e6edf3',
        fontFamily: 'Be Vietnam Pro, Inter, sans-serif',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 100px',
      }}
    >
      <div style={{ textAlign: 'center', zIndex: 2, maxWidth: 1600 }}>
        {/* Chevron indicator */}
        <div
          style={{
            fontSize: 72,
            marginBottom: 24,
            color: '#06b6d4',
            opacity: arrowProgress,
            transform: `translateY(${(1 - arrowProgress) * 20}px)`,
          }}
        >
          ↗
        </div>

        {/* Phase 2 badge */}
        <div
          style={{
            display: 'inline-block',
            fontSize: 20,
            fontWeight: 700,
            color: '#06b6d4',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: 20,
            opacity: headlineProgress,
          }}
        >
          Phase 2 · v1.1 · Sprint 4
        </div>

        {/* Main headline */}
        <h2
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 140,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            margin: 0,
            opacity: headlineProgress,
            transform: `translateY(${(1 - headlineProgress) * 30}px)`,
          }}
        >
          Phase 2{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            đang tới.
          </span>
        </h2>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            justifyContent: 'center',
            marginTop: 60,
            flexWrap: 'wrap',
          }}
        >
          {PHASE_2.map((f, i) => {
            const enterDelay = 40 + i * 14;
            const progress = spring({
              frame: frame - enterDelay,
              fps,
              config: { damping: 14, stiffness: 180 },
            });
            return (
              <div
                key={f.code}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '20px 36px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(6,182,212,0.4)',
                  borderRadius: 999,
                  fontSize: 32,
                  fontWeight: 600,
                  opacity: progress,
                  transform: `translateY(${(1 - progress) * 20}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#06b6d4',
                    fontWeight: 800,
                  }}
                >
                  {f.code}
                </span>
                <span>{f.name}</span>
              </div>
            );
          })}
        </div>

        {/* CTA / date */}
        <div
          style={{
            marginTop: 80,
            fontSize: 32,
            color: '#8b949e',
            fontWeight: 500,
            opacity: ctaProgress,
            transform: `translateY(${(1 - ctaProgress) * 20}px)`,
          }}
        >
          Deadline: <strong style={{ color: '#e6edf3' }}>2026-04-29</strong>
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 26,
            color: '#4b5563',
            fontFamily: 'JetBrains Mono, monospace',
            opacity: interpolate(frame, [180, 220], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          primeproduction/ech-prime-web-v2
        </div>
      </div>
    </AbsoluteFill>
  );
};
