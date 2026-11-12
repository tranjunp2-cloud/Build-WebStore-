// Tutorial videos for Help Center Q&A answers (GitHub #2464). Keyed by QnAItem.id; a question without an entry
// shows its text answer only. One English-narrated cut with burned-in captions serves every locale.
// File names carry a content hash so /videos/* can be cached as immutable (next.config.ts headers()).

export interface QnAVideoMedia {
  /** H.264 720p MP4 with AAC narration */
  src: string
  /** WebP still shown before playback */
  poster: string
  /** Length in seconds, for the duration chip */
  duration: number
}

const media = (id: string, videoHash: string, posterHash: string, duration: number): QnAVideoMedia => ({
  src: `/videos/help-qna/${id}.${videoHash}.mp4`,
  poster: `/videos/help-qna/${id}.${posterHash}.webp`,
  duration,
})

export const QNA_VIDEOS: Readonly<Record<string, QnAVideoMedia>> = {
  'q-dashboard-metrics': media('q-dashboard-metrics', '0d8dd374', 'dd6bc5d0', 55),
  'q-dashboard-customize': media('q-dashboard-customize', 'c95dc9a7', 'c6330363', 47),
  'q-dashboard-seo': media('q-dashboard-seo', '1d11dae5', '2db1f1c7', 41),
  'q-builder-create': media('q-builder-create', '31bbcff6', '7812b00b', 60),
  'q-builder-edit': media('q-builder-edit', '59b02a06', '9566afe9', 37),
  'q-builder-mobile': media('q-builder-mobile', 'e369f1c8', 'b8040c7b', 32),
  'q-blog-create': media('q-blog-create', '74d5fe20', 'fe545fb6', 47),
  'q-blog-ai': media('q-blog-ai', '6d3c5f70', '9b9d17ae', 46),
  'q-blog-seo': media('q-blog-seo', 'e74309b5', 'f5995b7c', 43),
  'q-settings-domain': media('q-settings-domain', '83714191', 'a3ed09c7', 39),
  'q-settings-dns': media('q-settings-dns', '0013d23e', '6aad2696', 102),
  'q-settings-staff': media('q-settings-staff', '5de615df', 'ac663e9e', 43),
}

/** 102 → "1:42" */
export function formatVideoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
