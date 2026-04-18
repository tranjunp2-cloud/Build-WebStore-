export default function AIHarnessLoading() {
    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#faf5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 16,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: '#581c87',
            }}
        >
            <div
                style={{
                    width: 48,
                    height: 48,
                    border: '4px solid #d8b4fe',
                    borderTopColor: '#7c3aed',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }}
            />
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Calling GPT-4o…</h1>
            <p style={{ fontSize: 14, color: '#6b21a8' }}>
                AI đang generate blocks. ~5-15s lần đầu, lần 2 (cached) instant.
            </p>
            <style
                dangerouslySetInnerHTML={{
                    __html: `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`,
                }}
            />
        </div>
    )
}
