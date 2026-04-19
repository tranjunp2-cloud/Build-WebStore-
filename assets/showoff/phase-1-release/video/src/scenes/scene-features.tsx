import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Scene 2: Feature montage — 17 modules cascading in
const FEATURES = [
  { code: 'F01', name: 'AI Site Generator', color: '#8b5cf6' },
  { code: 'F02', name: 'Authentication', color: '#06b6d4' },
  { code: 'F03', name: 'Dashboard', color: '#22c55e' },
  { code: 'F05', name: 'AI Editor', color: '#ec4899' },
  { code: 'F06', name: 'Onboarding', color: '#f59e0b' },
  { code: 'F07', name: 'Template Gallery', color: '#8b5cf6' },
  { code: 'F08', name: 'Product CRUD', color: '#06b6d4' },
  { code: 'F10', name: 'Orders', color: '#22c55e' },
  { code: 'F11', name: 'Undo / Redo', color: '#ec4899' },
  { code: 'F12', name: 'Auto-save', color: '#f59e0b' },
  { code: 'F16', name: 'Notifications', color: '#8b5cf6' },
  { code: 'F17', name: 'Blog', color: '#06b6d4' },
  { code: 'F18', name: 'CMS Layout', color: '#22c55e' },
  { code: 'F19', name: 'Store Config', color: '#ec4899' },
  { code: 'F20', name: 'Help Center', color: '#f59e0b' },
  { code: 'F21', name: 'i18n (VI/EN/MS)', color: '#8b5cf6' },
  { code: 'F23', name: 'Subdomain', color: '#06b6d4' },
];

export const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at 50% 20%, rgba(139,92,246,0.18), transparent 55%), #0b0d10',
        padding: '80px 100px',
        color: '#e6edf3',
        fontFamily: 'Be Vietnam Pro, Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 60, opacity: headerProgress }}>
        <div
          style={{
            display: 'inline-block',
            fontSize: 18,
            fontWeight: 700,
            color: '#8b5cf6',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Đã ship
        </div>
        <h2
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 96,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.03em',
          }}
        >
          17 feature modules
        </h2>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 20,
          maxWidth: 1720,
          margin: '0 auto',
        }}
      >
        {FEATURES.map((f, i) => {
          const enterDelay = 15 + i * 5;
          const progress = spring({
            frame: frame - enterDelay,
            fps,
            config: { damping: 16, stiffness: 180 },
          });
          return (
            <div
              key={f.code}
              style={{
                background: 'rgba(22,27,34,0.9)',
                border: `1px solid ${f.color}40`,
                borderRadius: 18,
                padding: 28,
                opacity: progress,
                transform: `translateY(${(1 - progress) * 40}px) scale(${0.92 + progress * 0.08})`,
                boxShadow: `0 16px 32px -12px ${f.color}25`,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${f.color}, ${f.color}cc)`,
                  color: 'white',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 800,
                  fontSize: 18,
                  marginBottom: 16,
                }}
              >
                {f.code}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3' }}>{f.name}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
