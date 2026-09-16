import type { Page } from 'playwright'
import type { WebsiteBlueprint } from './pw1-contract'

/** Read rendered slide frames, never intrinsic image dimensions. */
export function inspectCarouselFrames() {
    return Array.from(document.querySelectorAll('.swiper, .swiper-container')).flatMap(root => {
        const frame = root.getBoundingClientRect()
        const slides = Array.from(root.querySelectorAll(':scope > .swiper-wrapper > .swiper-slide'))
        if (frame.width < 100 || !slides.length) return []
        return slides.flatMap(slide => {
            const image = slide.querySelector('img')
            if (!image || !image.complete || !image.naturalWidth) return []
            const rect = image.getBoundingClientRect(), style = getComputedStyle(image)
            const slideRect = slide.getBoundingClientRect()
            const visibleCount = frame.width / slideRect.width
            const count = Math.round(visibleCount)
            const ratio = rect.width / rect.height
            if (Math.abs(visibleCount - count) > 0.08 || rect.width < 100 || rect.height < 40 || ratio < 0.2 || ratio > 10 || count < 1 || count > 6 || !['cover','contain','scale-down'].includes(style.objectFit)) return []
            return [{ imageUrl: image.currentSrc || image.src, aspectRatio: ratio, imageFit: style.objectFit as 'cover'|'contain'|'scale-down', slidesPerView: count }]
        })
    })
}
export type CarouselFrame = ReturnType<typeof inspectCarouselFrames>[number]
export async function readCarouselFrames(page: Page): Promise<CarouselFrame[]> {
    return page.evaluate('(() => { const __name = (fn) => fn; return (' + inspectCarouselFrames.toString() + ')(); })()')
}
export function applyCarouselEvidence(blueprint: WebsiteBlueprint, frames: CarouselFrame[]) {
    const records: Array<{ sourceId: string; status: string }> = []
    for (const page of blueprint.nativeContract.pages) for (const component of page.components) {
        const layout = component.block.sourceLayout as Record<string, unknown> | undefined
        if (component.kind !== 'banner' || layout?.size !== 'small') continue
        if (layout.aspectRatio && layout.imageFit && layout.slidesPerView) { records.push({sourceId:component.sourceId,status:'explicit-source-config'}); continue }
        const slides = component.block.slides as Array<{image?: {url?: string}}> | undefined
        const matches = frames.filter(frame => slides?.some(slide => slide.image?.url === frame.imageUrl))
        const first = matches[0]
        // Shared images with conflicting frames are ambiguous; do not guess a theme or component.
        if (!first || matches.some(frame => Math.abs(frame.aspectRatio - first.aspectRatio) > 0.02 || frame.imageFit !== first.imageFit || frame.slidesPerView !== first.slidesPerView)) {
            records.push({sourceId:component.sourceId,status:'unverified'}); continue
        }
        component.block.sourceLayout = { aspectRatio:first.aspectRatio, imageFit:first.imageFit, slidesPerView:first.slidesPerView, ...layout }
        records.push({sourceId:component.sourceId,status:'observed-source-frame'})
    }
    return records
}
