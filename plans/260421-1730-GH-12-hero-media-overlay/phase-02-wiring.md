# Phase 02 u2014 SiteRenderer + Variant Wiring

**Status:** completed  
**Depends on:** phase-01 (BlockEditCallbackContext + HeroMediaOverlay phải tồn tại)

## Overview

1. Extend `SiteRenderer` với `onBlockFieldChange` prop + cung cấp `BlockEditCallbackContext` per block
2. Wire `HeroMediaOverlay` vào 6 hero variants có image/video

## Related files

- Modify: `src/components/site-renderer/SiteRenderer.tsx`
- Modify: `src/blocks/hero/variants/split.tsx` u2014 split-left + split-right (field: `image.url`)
- Modify: `src/blocks/hero/variants/magazine.tsx` u2014 field: `image.url`
- Modify: `src/blocks/hero/variants/cards-overlay.tsx` u2014 field: `image.url`
- Modify: `src/blocks/hero/variants/slideshow.tsx` u2014 field per slide index: `images[i].url`
- Modify: `src/blocks/hero/variants/video.tsx` u2014 image + video fields
- Modify: `src/blocks/hero/variants/split-video.tsx` u2014 image + video fields

## Step 1 u2014 SiteRenderer extension

Thêm prop `onBlockFieldChange` vào `SiteRendererProps`:
```ts
onBlockFieldChange?: (blockIndex: number, field: string, value: unknown) => void
```

Trong blocks.map loop (line ~284), khi `isEditor` wrap thêm `BlockEditCallbackProvider`:
```tsx
import { BlockEditCallbackProvider } from './BlockEditCallbackContext'

// Trong blockContent JSX (chỉ khi isEditor):
const callbackValue = onBlockFieldChange
    ? { blockIndex: index, onFieldChange: (field: string, value: unknown) => onBlockFieldChange(index, field, value) }
    : null

// Wrap blockContent với provider:
<BlockEditCallbackProvider value={callbackValue}>
    {blockContent}
</BlockEditCallbackProvider>
```

**Lưu ý:** `callbackValue` = null khi `onBlockFieldChange` undefined u2014 overlay tự disable theo logic của HeroMediaOverlay.

**Lưu ý:** Provider cần bao bọc cả `HeadingProvider` + `BlockErrorBoundary` block:
```tsx
const blockContent = (
    <BlockEditCallbackProvider value={callbackValue}>
        <BlockErrorBoundary ...>
            <HeadingProvider ...>
                <BlockComponent ... />
            </HeadingProvider>
        </BlockErrorBoundary>
    </BlockEditCallbackProvider>
)
```

## Step 2 u2014 Wire split.tsx

Image area trong split.tsx là `motion.img` trong `motion.div` container. Wrap container div với `HeroMediaOverlay`:
```tsx
import { HeroMediaOverlay, ... } from '../shared'

// Wrap motion.div image container:
<HeroMediaOverlay field="image.url" altText={safeAltText(image?.alt, headline)}>
    <motion.div ...>
        <img ... />
    </motion.div>
</HeroMediaOverlay>
```

## Step 3 u2014 Wire magazine.tsx

Tương tự split.tsx u2014 wrap image container `motion.div` (cái có `ref={imageRef}`):
```tsx
<HeroMediaOverlay field="image.url" altText={safeAltText(image?.alt, headline)}>
    <motion.div ref={imageRef} className="relative overflow-hidden rounded-2xl">
        ...
    </motion.div>
</HeroMediaOverlay>
```

## Step 4 u2014 Wire cards-overlay.tsx

Background là `<div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: ...}}>`.
Wrap outer section hoặc tạo overlay riêng bên trong:
```tsx
// Thêm overlay button riêng (vì background là CSS background-image, không phải <img>)
// Wrap relative container với HeroMediaOverlay className="absolute inset-0":
<HeroMediaOverlay
    field="image.url"
    altText={safeAltText(image?.alt, headline)}
    className="absolute inset-0"
>
    <div className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image?.url || fallbackHeroUrl})` }} />
</HeroMediaOverlay>
```

## Step 5 u2014 Wire slideshow.tsx

Slideshow có nhiều slides u2014 mỗi slide là một ảnh. Overlay per-slide:
```tsx
// Trong slides.map, wrap background div:
<HeroMediaOverlay
    key={i}
    field={`images.${i}.url`}
    altText={`Slide ${i + 1}`}
    className="absolute inset-0"
>
    <motion.div className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${slide.url})` }} />
</HeroMediaOverlay>
```

## Step 6 u2014 Wire video.tsx (image + video)

Cả image fallback lẫn video có thể edit:
```tsx
// Wrap video element + fallback div cùng 1 HeroMediaOverlay:
<HeroMediaOverlay
    field="image.url"
    altText={safeAltText(image?.alt, headline)}
    showVideoButton={true}
    videoField="videoUrl"
    currentVideoUrl={videoUrl}
    className="absolute inset-0"
>
    {videoUrl && !isMobile ? (
        <video ... />
    ) : (
        <div className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${image?.url || fallbackHeroUrl})` }} />
    )}
</HeroMediaOverlay>
```

## Step 7 u2014 Wire split-video.tsx

Tương tự video.tsx nhưng image ở half bên phải:
```tsx
<HeroMediaOverlay
    field="image.url"
    altText={safeAltText(image?.alt, headline)}
    showVideoButton={true}
    videoField="videoUrl"
    currentVideoUrl={videoUrl}
    className="absolute inset-0"
>
    {videoUrl && !isMobile ? (
        <video ref={videoRef} ... />
    ) : (
        <div ... style={{ backgroundImage: `url(${image?.url || fallbackHeroUrl})` }} />
    )}
</HeroMediaOverlay>
```

## Todo

- [ ] Extend `SiteRendererProps` với `onBlockFieldChange?`
- [ ] Import `BlockEditCallbackProvider` vào SiteRenderer.tsx
- [ ] Wrap blockContent với `BlockEditCallbackProvider` trong blocks.map
- [ ] Wire `HeroMediaOverlay` vào split.tsx
- [ ] Wire `HeroMediaOverlay` vào magazine.tsx
- [ ] Wire `HeroMediaOverlay` vào cards-overlay.tsx
- [ ] Wire `HeroMediaOverlay` vào slideshow.tsx (per-slide)
- [ ] Wire `HeroMediaOverlay` vào video.tsx (image + video)
- [ ] Wire `HeroMediaOverlay` vào split-video.tsx (image + video)
- [ ] TypeScript compile check tất cả files modified

## Success criteria

- `SiteRenderer` render không thay đổi khi `onBlockFieldChange` = undefined (public sites)
- `HeroMediaOverlay` hover buttons hiển thị đúng khi isEditor + isOwner
- `onFieldChange('image.url', newUrl)` được gọi sau upload thành công
- `onFieldChange('videoUrl', url)` được gọi sau VideoInputPopover submit
- Không có TypeScript error (tsc --noEmit pass)

## Risk

- cards-overlay + slideshow dùng CSS background-image thay vì `<img>` u2014 overlay position phải `absolute inset-0` thay vì wrap thông thường
- slideshow field path `images.${i}.url` phải match cách SettingsPanel đang dùng để update u2014 verify với `src/components/editor/SettingsPanel.tsx` trước khi implement
- HeroMediaOverlay className prop trên `absolute inset-0` cases: parent container phải có `position: relative`
