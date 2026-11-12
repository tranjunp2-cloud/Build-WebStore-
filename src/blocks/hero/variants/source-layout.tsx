'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'
import { RichText } from '../../shared/RichText'
import styles from './source-layout.module.css'
export function SourceLayoutHero({ block }: BlockProps<HeroConfig>) {
    const slides = block.slides?.length ? block.slides : [{ headline: block.headline, subheadline: block.subheadline, image: block.image, ctaButtons: block.ctaButtons || [] }]
    const [index, setIndex] = useState(0)
    const current = index % slides.length
    const layout = block.sourceLayout!
    useEffect(() => {
        if (!layout.autoplay || slides.length < 2) return
        const id = setInterval(() => setIndex(i => (i + 1) % slides.length), layout.interval)
        return () => clearInterval(id)
    }, [layout.autoplay, layout.interval, slides.length])
    return <section className={`${styles.banner} ${layout.size === 'hero' ? styles.hero : styles.small}`} data-source-component={layout.sourceComponentId}>
        {slides.map((slide, i) => <div key={i} className={styles.slide} aria-hidden={i !== current} style={{ opacity: i === current ? 1 : 0, pointerEvents: i === current ? 'auto' : 'none' }}>
            {slide.image?.url && <Image src={slide.image.url} alt={slide.image.alt || ''} fill unoptimized priority={i === 0} sizes="100vw" style={{ objectFit: 'cover' }} />}
            <div className={styles.copy}>
                {slide.headline && <h1><RichText text={slide.headline} /></h1>}
                {slide.subheadline && <p><RichText text={slide.subheadline} /></p>}
                {slide.ctaButtons?.map((button, j) => <a key={j} href={button.url}>{button.label}</a>)}
            </div>
        </div>)}
        {slides.length > 1 && <>
            <button className={`${styles.arrow} ${styles.previous}`} aria-label="Previous slide" onClick={() => setIndex(i => (i - 1 + slides.length) % slides.length)}>‹</button>
            <button className={`${styles.arrow} ${styles.next}`} aria-label="Next slide" onClick={() => setIndex(i => (i + 1) % slides.length)}>›</button>
            <div className={styles.dots}>{slides.map((_, i) => <button key={i} aria-label={`Go to slide ${i + 1}`} aria-current={i === current} onClick={() => setIndex(i)}><span style={{ background: i === current ? '#fff' : '#ffffff70' }} /></button>)}</div>
        </>}
    </section>
}
