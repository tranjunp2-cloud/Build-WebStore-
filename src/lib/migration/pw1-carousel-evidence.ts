import type { Page } from 'playwright'
import type { WebsiteBlueprint } from './pw1-contract'

export type CarouselFrame = {
    imageUrl: string; aspectRatio: number; imageFit: 'cover' | 'contain' | 'scale-down'; slidesPerView: number
    pageId?: string; sourceImageUrls?: string[]; naturalWidth?: number; naturalHeight?: number
    frameWidth?: number; frameHeight?: number
}

/** Runs inside the source browser. Only measured frames and declared image alternatives qualify. */
export async function inspectCarouselFrames(): Promise<CarouselFrame[]> {
    const frames: CarouselFrame[] = []
    const probes = new Map<string, HTMLImageElement | undefined>()
    let probeBudget = 16
    const roots = document.querySelectorAll('.swiper, .swiper-container, .slick-list, .owl-stage-outer, .carousel-inner')
    for (const root of Array.from(roots).slice(0, 30)) {
        const viewport = root.getBoundingClientRect()
        const slides = Array.from(root.querySelectorAll(':scope > .swiper-wrapper > .swiper-slide, :scope > .slick-track > .slick-slide, :scope > .owl-stage > .owl-item, :scope > .carousel-item'))
        const measured = slides.map(slide => ({ slide, rect: slide.getBoundingClientRect() })).filter(s => s.rect.width > 0)
        if (viewport.width < 100 || !measured.length) continue
        // Pitch includes gap/margins. W / slideWidth alone undercounts gapped multi-item rows.
        const widths = measured.map(s => s.rect.width)
        const slideWidth = widths[0]
        if (widths.some(w => Math.abs(w - slideWidth) > 2)) continue
        const positions = measured.map(s => s.rect.left).sort((a,b) => a-b)
        const pitches = positions.slice(1).map((x,i) => x-positions[i]).filter(x => x > slideWidth - 2)
        const pitch = pitches.length ? Math.min(...pitches) : slideWidth
        const gap = Math.max(0, pitch - slideWidth)
        const visibleCount = (viewport.width + gap) / (slideWidth + gap)
        const count = Math.round(visibleCount)
        if (Math.abs(visibleCount - count) > 0.08 || count < 1 || count > 6) continue
        for (const {slide} of measured.slice(0, 60)) {
            const img = slide.querySelector('img')
            const background = img ? null : [slide,...Array.from(slide.querySelectorAll('*')).slice(0,40)]
                .find(el => /^url\(["']?[^"')]+["']?\)$/.test(getComputedStyle(el).backgroundImage))
            const element = img ?? background
            if (!element) continue
            const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
            const fit = img ? style.objectFit : style.backgroundSize
            const ratio = rect.width / rect.height
            if (rect.width < 100 || rect.height < 40 || ratio < 0.2 || ratio > 10 || !['cover','contain','scale-down'].includes(fit)) continue
            const source = img ? img.src : style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '')
            const aliases = [source]
            let selected = img?.currentSrc || source
            let naturalWidth = img?.naturalWidth ?? 0, naturalHeight = img?.naturalHeight ?? 0
            // srcset is an explicit alternate representation. Never synthesize an "original" URL.
            const candidates = (img?.srcset ?? '').split(',').map(part => part.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)[wx]$/))
                .filter((m): m is RegExpMatchArray => Boolean(m)).map(m => ({url:new URL(m[1],document.baseURI).href,size:Number(m[2])}))
                .filter(c => /^https?:/.test(c.url)).sort((a,b)=>b.size-a.size)
            aliases.push(...candidates.map(c=>c.url))
            const candidate = candidates[0]?.url || (!img ? source : undefined)
            if ((candidate && candidate !== selected) || !img) {
                const probeUrl = candidate || source
                if (!probes.has(probeUrl) && probeBudget-- > 0) probes.set(probeUrl, await new Promise<HTMLImageElement | undefined>(resolve => {
                    const probe = new Image()
                    const timer = setTimeout(() => { probe.onload=null; probe.onerror=null; probe.src=''; resolve(undefined) }, 1000)
                    probe.onload = () => { clearTimeout(timer); resolve(probe) }
                    probe.onerror = () => { clearTimeout(timer); resolve(undefined) }
                    probe.src = probeUrl
                }))
                const loaded = probes.get(probeUrl)
                if (loaded?.naturalWidth && (!naturalWidth || (loaded.naturalWidth > naturalWidth && Math.abs((loaded.naturalWidth / loaded.naturalHeight) / (naturalWidth / naturalHeight) - 1) < 0.02))) {
                    selected = loaded.src; naturalWidth = loaded.naturalWidth; naturalHeight = loaded.naturalHeight
                }
            }
            if (!naturalWidth || !naturalHeight || !/^https?:/.test(selected) || !/^https?:/.test(source)) continue
            frames.push({imageUrl:selected,sourceImageUrls:aliases,aspectRatio:ratio,imageFit:fit as CarouselFrame['imageFit'],slidesPerView:count,naturalWidth,naturalHeight,frameWidth:rect.width,frameHeight:rect.height})
        }
    }
    return frames
}
export async function readCarouselFrames(page: Page): Promise<CarouselFrame[]> {
    return page.evaluate('(() => { const __name = (fn) => fn; return (' + inspectCarouselFrames.toString() + ')(); })()')
}
export function applyCarouselEvidence(blueprint: WebsiteBlueprint, frames: CarouselFrame[]) {
    const records: Array<{ pageId: string; sourceId: string; status: string; reason?: string; images: Array<{sourceUrl:string;selectedUrl:string;upscale?:number}> }> = []
    for (const page of blueprint.nativeContract.pages) for (const component of page.components) {
        const layout = component.block.sourceLayout as Record<string, unknown> | undefined
        if (component.kind !== 'banner' || layout?.size !== 'small') continue
        const slides = component.block.slides as Array<{image?: {url?: string}}> | undefined
        const scoped = frames.filter(frame => frame.pageId === page.sourceId || (!frame.pageId && page.isHomepage))
        const matches = scoped.filter(frame => slides?.some(slide => slide.image?.url && [frame.imageUrl,...frame.sourceImageUrls ?? []].includes(slide.image.url)))
        const first = matches[0]
        const explicit = Boolean(layout.aspectRatio && layout.imageFit && layout.slidesPerView)
        const verified = first && !matches.some(frame => Math.abs(frame.aspectRatio - first.aspectRatio) > 0.02 || frame.imageFit !== first.imageFit || frame.slidesPerView !== first.slidesPerView)
        const images: Array<{sourceUrl:string;selectedUrl:string;upscale?:number}> = []
        if (verified) {
            for (const slide of slides ?? []) {
                if (!slide.image?.url) continue
                const sourceUrl = slide.image.url
                const alternatives = matches.filter(f=>[f.imageUrl,...f.sourceImageUrls ?? []].includes(sourceUrl))
                const selected = alternatives.sort((a,b)=>(b.naturalWidth ?? 0)-(a.naturalWidth ?? 0))[0]
                if (!selected) continue
                slide.image.url = selected.imageUrl
                images.push({sourceUrl,selectedUrl:selected.imageUrl,...(selected.naturalWidth && selected.naturalHeight && selected.frameWidth && selected.frameHeight ? {upscale:Math.max(selected.frameWidth/selected.naturalWidth,selected.frameHeight/selected.naturalHeight)} : {})})
            }
            component.block.sourceLayout = { aspectRatio:first.aspectRatio, imageFit:first.imageFit, slidesPerView:first.slidesPerView, ...layout }
        }
        records.push({pageId:page.sourceId,sourceId:component.sourceId,status:explicit?'explicit-source-config':verified?'observed-source-frame':'unverified',...(!explicit && !verified ? {reason:first?'conflicting-source-frames':'no-matching-source-frame'} : {}),images})
    }
    return records
}
