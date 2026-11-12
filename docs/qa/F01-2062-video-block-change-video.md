# Test Cases: F01 Video Block — Change Video (GH-2062)
> **Version:** 1.0 | **Updated:** 2026-11-05 | **Status:** Active
> **Source:** `src/lib/video/parse-video-url.ts`, `src/blocks/video/index.tsx`, `src/blocks/video/video-media.tsx`, `src/components/editor/video-url-field.tsx`

## Objective
Block Video (variant Embed/Background) phải đổi được video: nút "Change Video" (upload mp4/webm) trên block, ô Video URL (YouTube/Vimeo) trong Block Settings, link sai báo lỗi và không lưu, URL render qua allowlist an toàn.

## Test Cases

| ID | Type | Title | Steps | Expected | Level | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F01-VID-001** | Unit | **[Positive]** `watch?v=ID` → embed | `parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')` | `kind:'youtube'`, `embedUrl=https://www.youtube.com/embed/dQw4w9WgXcQ` | Blocker | [x] |
| **TC-F01-VID-002** | Unit | **[Positive]** `&t=30s` và `m.youtube.com` → ID sạch | Parse 2 link | embedUrl không chứa `t=`, đúng ID | High | [x] |
| **TC-F01-VID-003** | Unit | **[Positive]** `youtu.be/ID?si=x`, `shorts/ID` | Parse 2 link | ID sạch, không dính `?si` | High | [x] |
| **TC-F01-VID-004** | Unit | **[Positive]** Vimeo (kể cả hash unlisted `/ID/HASH`) | `vimeo.com/123456789`, `player.vimeo.com/video/123` | `kind:'vimeo'`, embed `player.vimeo.com/video/{id}` | Medium | [x] |
| **TC-F01-VID-005** | Unit | **[Security]** Link không an toàn/sai bị từ chối | `javascript:`, `data:`, `http://youtube.com/...`, host lạ, rỗng, ID sai độ dài | `null` | Blocker | [x] |
| **TC-F01-VID-006** | Unit | **[Positive]** File mp4/webm | URL `.mp4?x=1`, `.webm`, path `/api/media/x.mp4` | `kind:'file'`; `//evil/x.mp4` → `null` | High | [x] |
| **TC-F01-VID-007** | Component | **[Positive]** Embed render đúng iframe; URL sai → placeholder | Render `VideoBlock` embed | iframe src chuẩn hoá; URL sai/rỗng không render iframe | Blocker | [x] |
| **TC-F01-VID-008** | Component | **[Positive]** Background: `playlist` sạch, file → `<video>` | Render background với `?si=` và `.mp4` | `playlist=ID` đúng; mp4 → `<video muted loop autoplay>` | High | [x] |
| **TC-F01-VID-009** | Component | **[Positive]** Owner thấy "Change Video" (2 variant); non-owner không | Render owner+callback / non-owner | Owner có nút; non-owner không | Blocker | [x] |
| **TC-F01-VID-010** | Component | **[Negative]** `VideoUrlField` validate khi blur | Blur link hợp lệ / link sai | Hợp lệ → `onChange(trimmed)`; sai hoặc rỗng (`videoUrl` required trong Pages.ts) → lỗi dưới field, không gọi `onChange` | Blocker | [x] |
| **TC-F01-VID-011** | E2E | **[Positive]** Editor: dán link → preview đổi → Publish → live đúng video | Thủ công trên dev | Video mới hiển thị ở preview và web live | High | [ ] |
