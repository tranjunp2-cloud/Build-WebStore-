import { uploadMediaAction } from '@/app/(dashboard)/actions/media'

export const EVIDENCE_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
const EVIDENCE_MEDIA_TYPES = new Set(EVIDENCE_MEDIA_ACCEPT.split(','))
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_VIDEO_SIZE = 20 * 1024 * 1024

export function addEvidenceMedia(description: string, url: string, type: string) {
    const attachment = type.startsWith('video/') ? `[Video bằng chứng](${url})` : `![Ảnh lỗi](${url})`
    const evidence = /^### Evidence\s*$/m.exec(description)
    if (!evidence || evidence.index === undefined) return `${description.trim()}\n\n### Evidence\n- ${attachment}`
    const afterEvidence = evidence.index + evidence[0].length
    const nextSection = /^### /gm
    nextSection.lastIndex = afterEvidence
    const next = nextSection.exec(description)
    const insertAt = next?.index ?? description.length
    return `${description.slice(0, insertAt).replace(/\s*$/, '')}\n- ${attachment}\n\n${description.slice(insertAt).replace(/^\s*/, '')}`
}

export async function uploadIssueEvidence(file: File, title: string) {
    if (!EVIDENCE_MEDIA_TYPES.has(file.type)) throw new Error('Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc video MP4, WebM.')
    const maximum = file.type.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (file.size > maximum) throw new Error(file.type.startsWith('video/') ? 'Video quá lớn. Tối đa 20MB.' : 'Ảnh quá lớn. Tối đa 5MB.')
    const formData = new FormData()
    formData.append('file', file, file.name || (file.type.startsWith('video/') ? 'bug-evidence.mp4' : 'bug-evidence.png'))
    formData.append('alt', `Bug evidence: ${title.trim() || 'issue evidence'}`)
    const uploaded = await uploadMediaAction(formData) as { url?: string | null }
    if (typeof uploaded.url !== 'string' || !uploaded.url) throw new Error('Tệp tải lên không có URL hợp lệ.')
    return { url: uploaded.url, type: file.type }
}
