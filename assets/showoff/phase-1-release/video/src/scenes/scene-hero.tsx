import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Scene 1: Big hero hook — "Phase 1 đã landed"
export const SceneHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeProgress = spring({ frame: frame - 5, fps, config: { damping: 14 } });
  const titleProgress = spring({ frame: frame - 20, fps, config: { damping: 16 } });
  const subProgress = spring({ frame: frame - 55, fps, config: { damping: 16 } });

  // Animated gradient shift
  const gradientX = interpolate(frame, [0, 210], [0, 100], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at ${20 + gradientX * 0.6}% 30%, rgba(139,92,246,0.35), transparent 55%),
                     radial-gradient(ellipse at ${80 - gradientX * 0.4}% 70%, rgba(236,72,153,0.3), transparent 55%),
                     radial-gradient(ellipse at 50% 110%, rgba(6,182,212,0.25), transparent 60%),
                     #0b0d10`,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Be Vietnam Pro, Inter, sans-serif',
        color: '#e6edf3',
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />

      <div style={{ textAlign: 'center', zIndex: 2, maxWidth: 1600, padding: '0 80px' }}>
        {/* Live badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '14px 28px',
            borderRadius: 999,
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 56,
            opacity: badgeProgress,
            transform: `translateY(${(1 - badgeProgress) * 20}px)`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 16px rgba(34,197,94,0.8)',
            }}
          />
          Phase 1 — Đã landed 2026-04-19
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 180,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            margin: 0,
            opacity: titleProgress,
            transform: `translateY(${(1 - titleProgress) * 40}px)`,
          }}
        >
          <div>ECH Prime</div>
          <div
            style={{
              background:
                'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Web v2
          </div>
        </h1>

        <p
          style={{
            fontSize: 42,
            color: '#8b949e',
            marginTop: 48,
            fontWeight: 500,
            opacity: subProgress,
            transform: `translateY(${(1 - subProgress) * 20}px)`,
          }}
        >
          Phase 1 đã hoàn thành.
        </p>
      </div>
    </AbsoluteFill>
  );
};
