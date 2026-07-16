"use client"

import React, { useState } from 'react'
import Image from 'next/image'
import { ScanBarcode, Plus, ChevronUp } from 'lucide-react'
import './items-table.css'
import { useI18n } from '@/i18n'
import type { OrderDetail } from '../OrderDetailPanel'

// ── Product shape resolved at depth=2 ────────────────────────────────────────
// The `product` field on an order item is a relationship. At depth=2 Payload
// resolves it to the full product document. We type only the fields we use.
interface ResolvedProduct {
    id?: string | number
    sku?: string | null
    weight?: number | null          // kg (Products.weight canonical unit, confirmed 2026-07-06)
    images?: Array<{
        image?: {
            url?: string | null
        } | string | null
    }> | null
}

// ── Monogram palette (stable, index-based) ───────────────────────────────────
const MONO_COLORS = [
    '#3b5bdb', '#0c8599', '#2f9e44', '#e67700',
    '#c2255c', '#6741d9', '#1971c2', '#087f5b',
]

function monoColor(index: number): string {
    return MONO_COLORS[index % MONO_COLORS.length]
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Currency formatter ────────────────────────────────────────────────────────
function fmtAmount(currency: string, amountRinggit: number): string {
    return `${currency} ${amountRinggit.toLocaleString('en-MY', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
function ItemThumb({
    imageUrl,
    name,
    colorIndex,
}: {
    imageUrl?: string | null
    name: string
    colorIndex: number
}) {
    if (imageUrl) {
        return (
            <span className="it-thumb">
                <Image
                    src={imageUrl}
                    alt={name}
                    fill
                    sizes="40px"
                    style={{ objectFit: 'cover' }}
                />
            </span>
        )
    }
    return (
        <span
            className="it-thumb"
            style={{ background: monoColor(colorIndex) }}
            aria-label={`${name} monogram`}
        >
            {initials(name)}
        </span>
    )
}

// ── Main component ────────────────────────────────────────────────────────────
const VISIBLE_CAP = 3

export function OrderItemsCard({ order }: { order: OrderDetail }) {
    const { t, ti } = useI18n()
    const d = t.dashboard.orders.detail
    const [expanded, setExpanded] = useState(false)

    if (!order.items || order.items.length === 0) return null

    const items = order.items
    const hasMore = items.length > VISIBLE_CAP
    const visibleItems = expanded ? items : items.slice(0, VISIBLE_CAP)
    const hiddenCount = items.length - VISIBLE_CAP

    // Determine if ANY item has a resolved product with weight so we know
    // whether to show the Weight column at all.
    const anyHasWeight = items.some((it) => {
        const p = it.product as ResolvedProduct | string | number | undefined
        return typeof p === 'object' && p !== null && (p.weight ?? 0) > 0
    })

    const noWeightClass = anyHasWeight ? '' : ' itab--no-weight'

    // Summary values — discountAmount is stored in sen (÷100 = MYR)
    const subtotal = order.subtotal ?? 0
    const shippingFee = order.shippingFee ?? 0
    const discountAmountMYR = (order.discountAmount ?? 0) / 100
    const hasDiscount = (order.discountAmount ?? 0) > 0
    const total = order.total ?? 0
    const currency = order.currency ?? 'MYR'

    return (
        <div className={`itab${noWeightClass}`}>
            {/* ── Table header ──────────────────────────────────────────── */}
            <div className="itab-head">
                <span>{d.itemHeader}</span>
                <span className="ta-c">{d.qty}</span>
                {anyHasWeight && <span className="ta-c">{d.weight}</span>}
                <span className="ta-r">{d.price}</span>
            </div>

            {/* ── Item rows ─────────────────────────────────────────────── */}
            {visibleItems.map((item, idx) => {
                const product =
                    typeof item.product === 'object' && item.product !== null
                        ? (item.product as ResolvedProduct)
                        : null

                // Image: first image in product.images[0].image.url
                const rawImage = product?.images?.[0]?.image
                const imageUrl =
                    rawImage && typeof rawImage === 'object'
                        ? (rawImage.url ?? null)
                        : null

                const sku = product?.sku ?? null
                // Products.weight is already in KG (canonical unit, confirmed 2026-07-06) — show
                // it directly as kg. Reading it as grams previously showed "0.1 g" for a 0.1 kg item.
                const weightKg = product?.weight ?? 0
                const weightDisplay =
                    anyHasWeight && weightKg > 0
                        ? `${Number(weightKg.toFixed(2))} kg`
                        : anyHasWeight
                        ? '—'
                        : null

                const linePrice = item.unitPrice * item.quantity

                return (
                    <div className="itab-row" key={idx}>
                        {/* Item cell: thumb + name + SKU + attrs */}
                        <div className="it-cell">
                            <ItemThumb
                                imageUrl={imageUrl}
                                name={item.productName}
                                colorIndex={idx}
                            />
                            <div className="it-tx">
                                <div className="it-name" title={item.productName}>
                                    {item.productName}
                                </div>
                                {sku && (
                                    <div className="it-sku">
                                        <ScanBarcode />
                                        {d.skuPrefix}{sku}
                                    </div>
                                )}
                                {item.variant && (
                                    <div className="it-attrs">{item.variant}</div>
                                )}
                            </div>
                        </div>

                        {/* Qty */}
                        <span className="ta-c it-qty">×{item.quantity}</span>

                        {/* Weight — only rendered if any item has weight */}
                        {anyHasWeight && (
                            <span className="ta-c it-kg">{weightDisplay}</span>
                        )}

                        {/* Price */}
                        <span className="ta-r it-price">
                            {fmtAmount(currency, linePrice)}
                        </span>
                    </div>
                )
            })}

            {/* ── Expand / collapse ─────────────────────────────────────── */}
            {hasMore && (
                <button
                    className="itab-more"
                    onClick={() => setExpanded((prev) => !prev)}
                    aria-expanded={expanded}
                >
                    {expanded ? (
                        <>
                            <ChevronUp />
                            {d.showFewer}
                        </>
                    ) : (
                        <>
                            <Plus />
                            {hiddenCount > 1 ? ti(d.showMorePlural, { count: hiddenCount }) : d.showMore}
                        </>
                    )}
                </button>
            )}

            {/* ── Summary ───────────────────────────────────────────────── */}
            <div className="itab-summary">
                <div className="is-row">
                    <span className="is-k">{d.subtotal}</span>
                    <span className="is-v">{fmtAmount(currency, subtotal)}</span>
                </div>

                <div className="is-row">
                    <span className="is-k">{d.shippingFee}</span>
                    <span className="is-v">{fmtAmount(currency, shippingFee)}</span>
                </div>

                {hasDiscount && (
                    <div className="is-row is-row--voucher">
                        <span className="is-k">
                            {d.voucher}
                            {order.discountCode && (
                                <code className="is-voucher">{order.discountCode}</code>
                            )}
                        </span>
                        <span className="is-v">
                            −{fmtAmount(currency, discountAmountMYR)}
                        </span>
                    </div>
                )}

                <div className="is-row is-total">
                    <span className="is-k">{d.total}</span>
                    <span className="is-v">{fmtAmount(currency, total)}</span>
                </div>
            </div>
        </div>
    )
}
