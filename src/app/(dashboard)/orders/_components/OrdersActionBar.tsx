import React from 'react'
import { Search, ChevronDown } from 'lucide-react'

export function OrdersActionBar() {
    return (
        <div className="flex flex-col gap-[22px] w-full">
            {/* Top Row (Figma Node 30955:250) */}
            <div className="flex flex-[1_0_0] items-center gap-[12px] self-stretch justify-between w-full">
                {/* Search Input (30955:269 & 30955:270) */}
                <div className="relative flex-1 h-[50px]">
                    <div className="absolute left-[16px] top-[15px] w-[20px] h-[20px] flex items-center justify-center pointer-events-none">
                        <svg width="20" height="23" viewBox="0 0 20 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9.66667 16.3333C13.3486 16.3333 16.3333 13.3486 16.3333 9.66667C16.3333 5.98477 13.3486 3 9.66667 3C5.98477 3 3 5.98477 3 9.66667C3 13.3486 5.98477 16.3333 9.66667 16.3333Z" stroke="#F8FAFC" strokeOpacity="0.4" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.58333 19.9173L3 16.334" stroke="#F8FAFC" strokeOpacity="0.4" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Order ID/Customer..."
                        className="w-full h-[50px] pl-[48px] pr-[16px] py-[12px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] text-[16px] leading-[1.2102272510528564em] font-normal text-[#F8FAFC] placeholder-[rgba(248,250,252,0.4)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                    />
                </div>

                {/* Dropdowns Container (30955:5708) */}
                <div className="flex items-center gap-[12px] h-[50px]">
                    {/* Dropdown 1 (30955:5710) - All dates */}
                    <button className="flex items-center justify-between w-[143px] h-[50px] pl-[15px] pr-[12px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] hover:bg-white/5 transition-colors shrink-0">
                        <span className="text-[16px] font-normal leading-[1.2102272510528564em] text-[#F8FAFC] truncate">All dates</span>
                        <ChevronDown strokeWidth={1.6666666269302368} className="w-[20px] h-[20px] text-[#F8FAFC] shrink-0" />
                    </button>

                    {/* Dropdown 2 (30955:5719) - All status */}
                    <button className="flex items-center justify-between w-[138px] h-[50px] pl-[15px] pr-[12px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] hover:bg-white/5 transition-colors shrink-0">
                        <span className="text-[16px] font-normal leading-[1.2102272510528564em] text-[#F8FAFC] truncate">All status</span>
                        <ChevronDown strokeWidth={1.6666666269302368} className="w-[20px] h-[20px] text-[#F8FAFC] shrink-0" />
                    </button>
                </div>
            </div>

            {/* Bottom Row - Action Button (Figma Node 30955:275) - Guessed/Restored for visual consistency, not strictly in 30955:250 */}
            <div className="flex items-start hidden">
                <button className="w-[140px] h-[50px] flex items-center justify-center bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] text-[16px] font-semibold text-[#F8FAFC] hover:bg-white/5 transition-colors shrink-0">
                    Confirm (0)
                </button>
            </div>
        </div>
    )
}
