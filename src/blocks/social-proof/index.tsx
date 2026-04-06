'use client'

import type { BlockProps } from '../types'
import type { SocialProofConfig, SocialProofReview } from './config'

function StarRating({ rating, color }: { rating: number; color: string }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
                <svg
                    key={i}
                    className="w-4 h-4"
                    viewBox="0 0 20 20"
                    fill={i < rating ? color : 'currentColor'}
                    style={{ opacity: i < rating ? 1 : 0.15 }}
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    )
}

function Avatar({ src, name, color }: { src?: string; name: string; color: string }) {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

    if (src) {
        return (
            <img src={src} alt={name} className="w-10 h-10 rounded-full object-cover" />
        )
    }

    return (
        <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: color }}
        >
            {initials}
        </div>
    )
}

function ReviewCard({ review, color, variant }: { review: SocialProofReview; color: string; variant: string }) {
    if (variant === 'minimal') {
        return (
            <div className="py-6 border-b last:border-b-0" style={{ borderColor: `${color}15` }}>
                <StarRating rating={review.rating} color={color} />
                <p className="mt-3 text-sm leading-relaxed opacity-80">{review.content}</p>
                <div className="flex items-center gap-3 mt-4">
                    <Avatar src={review.avatar} name={review.author} color={color} />
                    <div>
                        <p className="text-sm font-semibold">{review.author}</p>
                        {review.role && <p className="text-xs opacity-50">{review.role}</p>}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className="p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow duration-200"
            style={{ borderColor: `${color}20` }}
        >
            <StarRating rating={review.rating} color={color} />
            <p className="mt-4 text-sm leading-relaxed opacity-80">{review.content}</p>
            <div className="flex items-center gap-3 mt-6 pt-4 border-t" style={{ borderColor: `${color}10` }}>
                <Avatar src={review.avatar} name={review.author} color={color} />
                <div>
                    <p className="text-sm font-semibold">{review.author}</p>
                    {review.role && <p className="text-xs opacity-50">{review.role}</p>}
                </div>
            </div>
        </div>
    )
}

export function SocialProofBlock({ block, theme }: BlockProps<SocialProofConfig>) {
    const { variant = 'cards', headline, reviews = [] } = block

    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {headline && (
                    <div className="text-center mb-14">
                        <h2 className="text-4xl md:text-5xl font-bold font-heading">{headline}</h2>
                    </div>
                )}

                {variant === 'minimal' ? (
                    <div className="max-w-2xl mx-auto">
                        {reviews.map((review, i) => (
                            <ReviewCard key={i} review={review} color={theme.primaryColor} variant={variant} />
                        ))}
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 md:grid-cols-2 ${variant === 'grid' ? 'lg:grid-cols-3' : 'lg:grid-cols-3'} gap-6 max-w-6xl mx-auto`}>
                        {reviews.map((review, i) => (
                            <ReviewCard key={i} review={review} color={theme.primaryColor} variant={variant} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
