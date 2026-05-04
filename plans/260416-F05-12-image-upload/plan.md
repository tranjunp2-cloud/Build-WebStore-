---
title: "BUG-F05-12: Image upload & AI gen buttons frozen"
description: "Fix frozen upload/AI gen buttons — timeout handling, error recovery, S3 config check"
status: pending
priority: P1
effort: 2h
branch: fix/F05-12-image-upload-ai-gen
issue: 656
tags: [editor, media, F05, upload]
created: 2026-04-16
---

# BUG-F05-12: Image Upload / AI Gen không sử dụng được

## Problem
- Upload ảnh và AI generate ảnh đều không hoạt động
- Buttons bị đông cứng (frozen), không tắt được
- Cản trở hoàn toàn luồng chỉnh sửa hình ảnh

## Root Cause (3 issues)

### 1. Upload hangs khi S3 không available → button frozen
`BlockImageEditor.tsx`: `setIsUploading(true)` → `uploadMediaAction()` hangs → `finally` block never runs → button disabled forever.

Docker local dùng MinIO (`localhost:9000`) nhưng `.env.local` có thể trỏ sai hoặc MinIO không accessible từ app.

### 2. Không có timeout/error recovery
`handleFileSelect` và `handleImageReplace` không có timeout. Nếu S3 connection hang → vô thời hạn.

### 3. AI Image Gen chưa implement
`BlockImageEditor.tsx:104-112`: AI button hardcoded `disabled`. Đây là feature chưa có, không phải bug.

## Fix Plan

### Phase 1: Add timeout + error recovery cho upload (45m)
**Files:** `src/components/editor/BlockImageEditor.tsx`, `src/components/editor/PreviewFrame.tsx`

1. Wrap `uploadMediaAction()` trong `Promise.race` với 30s timeout
2. Đảm bảo `finally` block LUÔN reset state (`setIsUploading(false)`)
3. Show error toast khi timeout: "Upload failed — check your connection"
4. Add `AbortController` for cancellation

```typescript
const uploadWithTimeout = Promise.race([
    uploadMediaAction(formData),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), 30000))
])
```

### Phase 2: Add S3 connectivity check (30m)
**File:** `src/app/(dashboard)/actions/media.ts` hoặc `src/components/editor/BlockImageEditor.tsx`

1. Before upload, check S3 config exists via env check
2. If S3 not configured, show clear error: "Storage not configured"
3. Fallback: allow local filesystem upload for dev mode

### Phase 3: Improve AI gen button UX (15m)
**File:** `src/components/editor/BlockImageEditor.tsx`

1. Change disabled AI button text to clear message: "Coming Soon"
2. Add tooltip explaining feature is planned
3. Don't render button at all if feature not available (cleaner UX)

## Success Criteria
- Upload button recovers from timeout/error within 30s
- Clear error message when S3 not available
- No frozen/stuck buttons under any circumstance
- AI gen button clearly shows "Coming Soon" or hidden

## Risk: Low
- Timeout wrapper is additive — doesn't change success path
- S3 check is read-only — no side effects
- AI button change is cosmetic
