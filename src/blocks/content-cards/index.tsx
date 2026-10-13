'use client'
import Image from 'next/image'
import type { BlockProps } from '../types'
import type { ContentCardsConfig } from './config'
import styles from './content-cards.module.css'
export function ContentCardsBlock({ block }: BlockProps<ContentCardsConfig>) {
    return <section className={`${styles.section} ${styles[block.variant]} ${block.sourceContent.presentation === 'pw2' ? styles.redesign : ''}`} data-source-component={block.sourceComponentId}>
        <h2 className={styles.heading}>{block.headline}</h2>
        <div className={styles.grid}>
            {block.sourceContent.items.map((item, index) => <article key={`${item.sourceId}-${index}`} className={styles.card}>
                <a href={item.url} className={styles.imageLink} aria-label={item.title}>
                    {item.image?.url && <Image src={item.image.url} alt={item.image.alt || item.title} fill unoptimized sizes="(max-width:767px) 90vw, 33vw" className={styles.image} />}
                    {block.variant === 'categories' && <div className={styles.overlay}><h3>{item.title}</h3>{item.ctaLabel && <span>{item.ctaLabel}</span>}</div>}
                </a>
                {block.variant !== 'categories' && <div className={styles.body}>
                    {item.date && <time className={styles.date}>{item.date}</time>}
                    <h3><a href={item.url}>{item.title}</a></h3>
                    {item.summary && <p>{item.summary}</p>}
                    {item.price && <span className={styles.price}>{item.price}</span>}
                    {item.ctaLabel && <a href={item.url} className={styles.cta}>{item.ctaLabel}</a>}
                </div>}
            </article>)}
        </div>
    </section>
}
