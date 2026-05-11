'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Info, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { PricingConfig, PricingPlan } from '@/blocks/pricing/config'
import { mapVariantData, isMatrixVariant } from '@/blocks/pricing/variant-data-mapping'
import PlanFields from './PlanFields'
import PricingFeatureEditorModal from './PricingFeatureEditorModal'
import type { PageData } from '@/store/editorStore'
import { useI18n } from '@/i18n'

interface PricingSettingsProps {
    block: PricingConfig
    blockIndex: number
    onBlockUpdate: (idx: number, changes: Partial<PricingConfig>) => void
    pages?: PageData[]
}

const EMPTY_PLAN: PricingPlan = {
    name: '', price: '', description: '', features: [],
    ctaLabel: 'Get Started', ctaUrl: '', ctaActionType: 'external', ctaStyle: 'primary', highlighted: false,
}

export default function PricingSettings({ block, blockIndex, onBlockUpdate, pages }: PricingSettingsProps) {
    const { t, ti } = useI18n()
    const s = t.editor.settings
    const [activeTab, setActiveTab] = useState(0)
    const [removeVersion, setRemoveVersion] = useState(0)

    const [modalOpen, setModalOpen] = useState(false)
    // Tracks previous variant so useEffect can compute mapping direction correctly
    const prevVariantRef = useRef<PricingConfig['variant']>(block.variant)
    // Always-current ref so the variant-change effect reads fresh block state
    const blockRef = useRef(block)
    blockRef.current = block

    const plans = block.plans ?? []
    const count = Math.max(plans.length, 1)
    const isMatrix = isMatrixVariant(block.variant)

    // Local state for cycle/discount inputs — allows free typing; syncs from block only when not focused
    const [localDiscount, setLocalDiscount] = useState<string>(String(block.yearlyDiscount ?? 0))
    const [localCycle1, setLocalCycle1] = useState(block.billingCycle1 ?? 'Monthly')
    const [localCycle2, setLocalCycle2] = useState(block.billingCycle2 ?? 'Yearly')
    // Focus guard: prevents external prop changes from resetting cycle inputs while user is typing.
    // Safe invariant: cycle inputs only render under `block.variant === 'toggle'`, so a variant
    // switch unmounts and remounts them — resetting these refs to false automatically.
    // If cycle inputs are ever rendered unconditionally, replace this with value-comparison guards.
    const cycle1FocusRef = useRef(false)
    const cycle2FocusRef = useRef(false)
    // Tracks last value set by user input; useEffect skips reset when block update is user-initiated
    const discountUserValueRef = useRef<number | null>(null)
    useEffect(() => {
        if (discountUserValueRef.current !== (block.yearlyDiscount ?? 0)) {
            setLocalDiscount(String(block.yearlyDiscount ?? 0))
            discountUserValueRef.current = null
        }
    }, [block.yearlyDiscount])
    useEffect(() => { if (!cycle1FocusRef.current) setLocalCycle1(block.billingCycle1 ?? 'Monthly') }, [block.billingCycle1])
    useEffect(() => { if (!cycle2FocusRef.current) setLocalCycle2(block.billingCycle2 ?? 'Yearly') }, [block.billingCycle2])

    // Run data-shape mapping when variant changes (Standard ↔ Matrix conversion)
    useEffect(() => {
        const prev = prevVariantRef.current
        prevVariantRef.current = block.variant
        if (prev === block.variant) return
        const changes = mapVariantData({ ...blockRef.current, variant: prev }, block.variant)
        if (Object.keys(changes).length > 0) onBlockUpdate(blockIndex, changes)
    }, [block.variant]) // eslint-disable-line react-hooks/exhaustive-deps

    const updatePlans = (next: PricingPlan[]) => {
        onBlockUpdate(blockIndex, { plans: next })
    }

    const handleDecrement = () => {
        if (count <= 1) return
        const next = plans.slice(0, -1)
        setActiveTab(t => Math.min(t, next.length - 1))
        setRemoveVersion(v => v + 1)
        updatePlans(next)
    }

    const handleIncrement = () => {
        if (count >= 3) return
        updatePlans([...plans, { ...EMPTY_PLAN }])
        setActiveTab(plans.length)
    }

    const handlePlanFieldChange = (field: keyof PricingPlan, value: unknown) => {
        const next = [...plans]
        next[activeTab] = { ...next[activeTab], [field]: value }
        updatePlans(next)
    }

    return (
        <div className="mb-3 space-y-3">
            {/* Plans Management — always expanded, no chevron */}
            <div className="bg-[rgba(30,41,59,0.3)] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden">
                <div className="flex items-center px-3 h-12">
                    <span className="text-sm font-medium text-white">{s.pricingManagement}</span>
                </div>
                <div className="px-3 pb-3 space-y-3">
                    {/* Stepper — always first */}
                    <div className="flex gap-4 items-center">
                        <div className="w-[100px] shrink-0">
                            <p className="text-[12px] font-medium text-[#94a3b8] leading-4">{s.pricingNumberOfPlans}</p>
                            <p className="text-[10px] text-[#94a3b8] leading-4">{s.pricingPlansMinMax}</p>
                        </div>
                        <div className="flex flex-1 items-center justify-center gap-2">
                            <button
                                type="button"
                                aria-label={s.pricingDecreasePlanCount}
                                disabled={count <= 1}
                                onClick={handleDecrement}
                                className="h-[38px] w-[38px] rounded-xl bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)] flex items-center justify-center text-blue-400 disabled:opacity-30 transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <div className="h-[38px] w-11 rounded-xl bg-[rgba(31,41,55,0.5)] flex items-center justify-center text-white text-sm font-medium">
                                {count}
                            </div>
                            <button
                                type="button"
                                aria-label={s.pricingIncreasePlanCount}
                                disabled={count >= 3}
                                onClick={handleIncrement}
                                className="h-[38px] w-[38px] rounded-xl border border-[rgba(31,41,55,0.3)] flex items-center justify-center text-gray-400 disabled:opacity-30 hover:bg-white/5 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Discount section — toggle variant only, always visible */}
                    {block.variant === 'toggle' && (
                        <>
                            <p className="text-[12px] font-medium text-[#94a3b8]">{s.pricingDiscountPercentage}</p>
                            <div className="flex gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <p className="text-[12px] font-medium text-[#94a3b8]">{s.pricingCycle1}</p>
                                    <Input
                                        value={localCycle1}
                                        placeholder={s.pricingCycle1Placeholder}
                                        variant="editor"
                                        onFocus={() => { cycle1FocusRef.current = true }}
                                        onChange={e => setLocalCycle1(e.target.value)}
                                        onBlur={e => { cycle1FocusRef.current = false; onBlockUpdate(blockIndex, { billingCycle1: e.target.value }) }}
                                    />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <p className="text-[12px] font-medium text-[#94a3b8]">{s.pricingCycle2}</p>
                                    <Input
                                        value={localCycle2}
                                        placeholder={s.pricingCycle2Placeholder}
                                        variant="editor"
                                        onFocus={() => { cycle2FocusRef.current = true }}
                                        onChange={e => setLocalCycle2(e.target.value)}
                                        onBlur={e => { cycle2FocusRef.current = false; onBlockUpdate(blockIndex, { billingCycle2: e.target.value }) }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1">
                                    <p className="text-[12px] font-medium text-[#94a3b8]">{s.pricingDiscountPercent}</p>
                                    <Info className="w-3 h-3 text-gray-500" />
                                </div>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={localDiscount}
                                        variant="editor"
                                        className="pr-8"
                                        onChange={e => {
                                            setLocalDiscount(e.target.value)
                                            if (e.target.value === '') return
                                            const v = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                            discountUserValueRef.current = v
                                            onBlockUpdate(blockIndex, { yearlyDiscount: v })
                                        }}
                                        onBlur={e => {
                                            const v = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                            setLocalDiscount(String(v))
                                            if (v !== (block.yearlyDiscount ?? 0)) {
                                                discountUserValueRef.current = v
                                                onBlockUpdate(blockIndex, { yearlyDiscount: v })
                                            }
                                        }}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Plan tabs + Plan fields — separate container, always visible */}
            <div className="bg-[rgba(30,41,59,0.3)] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden p-px">
                {/* Tab bar */}
                <div className="bg-[#080e1d] flex gap-2 p-1 rounded-xl">
                    {(plans.length > 0 ? plans : [null]).map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setActiveTab(i)}
                            className={cn(
                                'flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors',
                                activeTab === i
                                    ? 'bg-[rgba(77,142,255,0.1)] text-[#adc6ff]'
                                    : 'text-[#c2c6d6] hover:bg-white/5'
                            )}
                        >
                            {ti(s.pricingPlanTab, { n: i + 1 })}
                        </button>
                    ))}
                </div>
                {/* Active plan fields; key forces remount on tab switch or plan removal */}
                <div className="p-3">
                    {plans[activeTab] && (
                        <PlanFields
                            key={`${activeTab}-${removeVersion}-${plans[activeTab]?.ctaLabel ?? ''}`}
                            plan={plans[activeTab]}
                            onChange={handlePlanFieldChange}
                            variant={block.variant}
                            pages={pages}
                        />
                    )}
                    {/* Edit Features button — matrix variants only */}
                    {isMatrix && (
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="mt-2 w-full py-2 rounded-[10px] text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-teal-400 opacity-90 hover:opacity-100 drop-shadow-[0px_1px_1px_rgba(0,0,0,0.1)] transition-opacity"
                        >
                            {s.pricingEditFeatures}
                        </button>
                    )}
                </div>
                <PricingFeatureEditorModal
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    matrix={block.featureMatrix ?? []}
                    planNames={plans.map(p => p.name || 'Plan')}
                    onSave={m => onBlockUpdate(blockIndex, { featureMatrix: m })}
                />
            </div>
        </div>
    )
}
