"use client"

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '@/i18n'

export function OrdersActionBar({
    pendingCount = 0,
    onBulkConfirm,
    isConfirming = false,
    onSearch,
    onFilterStatus,
    onFilterDate
}: {
    pendingCount?: number
    onBulkConfirm?: () => void
    isConfirming?: boolean
    onSearch?: (val: string) => void
    onFilterStatus?: (val: string) => void
    onFilterDate?: (val: string) => void
}) {
    const { t } = useI18n()
    const o = t.dashboard.orders

    const DATES_OPTIONS = useMemo(() => [
        { value: 'all', label: o.filterDates.allDates },
        { value: 'today', label: o.filterDates.today },
        { value: 'thisWeek', label: o.filterDates.thisWeek },
        { value: 'thisMonth', label: o.filterDates.thisMonth }
    ], [o])

    const STATUS_OPTIONS = useMemo(() => [
        { value: 'all', label: o.filterStatus.allStatus },
        { value: 'pending', label: o.status.pending },
        { value: 'confirmed', label: o.status.confirmed },
        { value: 'ready_to_ship', label: o.filters.readyToShip },
        { value: 'shipped', label: o.status.shipped },
        { value: 'completed', label: o.status.completed },
        { value: 'cancelled', label: o.status.cancelled },
        { value: 'refunded', label: o.status.refunded }
    ], [o])

    const [isDatesOpen, setIsDatesOpen] = useState(false)
    const [selectedDateIdx, setSelectedDateIdx] = useState(0)
    const datesRef = useRef<HTMLDivElement>(null)

    const [isStatusOpen, setIsStatusOpen] = useState(false)
    const [selectedStatusIdx, setSelectedStatusIdx] = useState(0)
    const statusRef = useRef<HTMLDivElement>(null)

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (datesRef.current && !datesRef.current.contains(event.target as Node)) {
                setIsDatesOpen(false)
            }
            if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
                setIsStatusOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="flex flex-col gap-[22px] w-full">
            {/* Top Row (Responsive: Stack on Mobile, Row on Desktop) */}
            <div className="flex flex-col md:flex-row flex-[1_0_0] items-start md:items-center gap-[12px] self-stretch justify-between w-full">
                {/* Search Input (30955:5468) */}
                <div className="relative w-full md:flex-1 h-[50px]">
                    <div className="absolute left-[16px] top-[15px] w-[20px] h-[20px] flex items-center justify-center pointer-events-none">
                        <svg width="20" height="23" viewBox="0 0 20 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9.66667 16.3333C13.3486 16.3333 16.3333 13.3486 16.3333 9.66667C16.3333 5.98477 13.3486 3 9.66667 3C5.98477 3 3 5.98477 3 9.66667C3 13.3486 5.98477 16.3333 9.66667 16.3333Z" stroke="#F8FAFC" strokeOpacity="0.4" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.58333 19.9173L3 16.334" stroke="#F8FAFC" strokeOpacity="0.4" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder={o.search}
                        onChange={(e) => onSearch?.(e.target.value)}
                        style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
                        className="w-full h-[50px] pl-[48px] pr-[16px] py-[12px] bg-[#1E293B] rounded-[16px] text-[16px] leading-[1.2102272510528564em] font-normal text-[#F8FAFC] placeholder-[rgba(248,250,252,0.4)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                    />
                </div>

                {/* Dropdowns Container */}
                <div className="flex items-center gap-[12px] w-full md:w-auto h-[50px]">
                    {/* Dropdown 1 - All dates */}
                    <div className="relative flex-1 md:flex-none" ref={datesRef}>
                        <button
                            onClick={() => setIsDatesOpen(!isDatesOpen)}
                            style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
                            className="flex items-center justify-between w-full md:w-[143px] h-[50px] pl-[15px] pr-[12px] bg-[#1E293B] rounded-[16px] hover:bg-white/5 transition-colors shrink-0"
                        >
                            <span className="text-[16px] font-normal leading-[1.2102272510528564em] text-[#F8FAFC] truncate">
                                {DATES_OPTIONS[selectedDateIdx].label}
                            </span>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={`shrink-0 transition-transform ${isDatesOpen ? 'rotate-180' : ''}`}>
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="#F8FAFC" strokeWidth="1.6666666269302368" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        {/* Dropdown Popover (31137:5911) */}
                        {isDatesOpen && (
                            <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex flex-col items-stretch w-[143px] py-[4px] drop-shadow-[0px_8px_24px_rgba(25,32,56,0.1)]">
                                {/* Arrow Top */}
                                <div className="flex flex-col w-full items-start px-[22px]">
                                    <svg width="12" height="6" viewBox="16 0 12 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="block relative top-[1px] z-10">
                                        <path d="M28 6L22 0L16 6H28Z" fill="#1F2937" />
                                    </svg>
                                </div>
                                {/* List */}
                                <div className="flex flex-col w-full bg-[#1F2937] py-[8px] rounded-[2px] z-0 overflow-hidden" style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    {DATES_OPTIONS.map((option, index) => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setSelectedDateIdx(index)
                                                setIsDatesOpen(false)
                                                onFilterDate?.(option.value)
                                            }}
                                            className={`flex items-center w-full px-[12px] py-[5px] text-left transition-colors ${selectedDateIdx === index ? 'bg-[#0B1120] hover:bg-[#0B1120]/80' : 'hover:bg-[#0B1120]/50'}`}
                                        >
                                            <span className="text-[14px] leading-[1.5714285714285714em] font-normal text-[#FFFFFF]">
                                                {option.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dropdown 2 (30955:5719) - All status */}
                    <div className="relative flex-1 md:flex-none" ref={statusRef}>
                        <button
                            onClick={() => setIsStatusOpen(!isStatusOpen)}
                            style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
                            className="flex items-center justify-between w-full md:w-[138px] h-[50px] pl-[15px] pr-[12px] bg-[#1E293B] rounded-[16px] hover:bg-white/5 transition-colors shrink-0"
                        >
                            <span className="text-[16px] font-normal leading-[1.2102272510528564em] text-[#F8FAFC] truncate">
                                {STATUS_OPTIONS[selectedStatusIdx].label}
                            </span>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={`shrink-0 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`}>
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="#F8FAFC" strokeWidth="1.6666666269302368" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        {/* Dropdown Popover */}
                        {isStatusOpen && (
                            <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex flex-col items-stretch w-[143px] py-[4px] drop-shadow-[0px_8px_24px_rgba(25,32,56,0.1)]">
                                {/* Arrow Top */}
                                <div className="flex flex-col w-full items-start px-[22px]">
                                    <svg width="12" height="6" viewBox="16 0 12 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="block relative top-[1px] z-10">
                                        <path d="M28 6L22 0L16 6H28Z" fill="#1F2937" />
                                    </svg>
                                </div>
                                {/* List */}
                                <div className="flex flex-col w-full bg-[#1F2937] py-[8px] rounded-[2px] z-0 overflow-hidden" style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    {STATUS_OPTIONS.map((option, index) => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setSelectedStatusIdx(index)
                                                setIsStatusOpen(false)
                                                onFilterStatus?.(option.value)
                                            }}
                                            className={`flex items-center w-full px-[12px] py-[5px] text-left transition-colors ${selectedStatusIdx === index ? 'bg-[#0B1120] hover:bg-[#0B1120]/80' : 'hover:bg-[#0B1120]/50'}`}
                                        >
                                            <span className="text-[14px] leading-[1.5714285714285714em] font-normal text-[#FFFFFF]">
                                                {option.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row - Confirm Button (Figma Node 30955:275) */}
            {/* Shown when items are selected */}
            <div className="flex items-start">
                <button
                    onClick={onBulkConfirm}
                    disabled={pendingCount === 0 || isConfirming}
                    style={{
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                    className={`w-[139.56px] h-[50px] flex items-center justify-center bg-[#1E293B] rounded-[16px] transition-colors shrink-0 ${pendingCount > 0 ? 'hover:bg-white/5 cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                >
                    <span
                        className="text-[16px] font-semibold leading-[1.5em] font-['Inter'] text-center flex items-center gap-2"
                        style={{ color: pendingCount > 0 ? '#F8FAFC' : 'rgba(248, 250, 252, 0.4)' }}
                    >
                        {isConfirming ? (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : null}
                        {o.confirm} ({pendingCount})
                    </span>
                </button>
            </div>
        </div>
    )
}
