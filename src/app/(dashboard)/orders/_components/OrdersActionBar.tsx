import React from 'react'
import { Search, ChevronDown } from 'lucide-react'

export function OrdersActionBar() {
    return (
        <div className="flex flex-col gap-[22px] w-full">
            {/* Top Row (Figma Node 30955:250) */}
            <div className="flex flex-col sm:flex-row items-center gap-[12px] w-full">
                {/* Search Input (30955:269 & 30955:270) */}
                <div className="relative w-full sm:max-w-[400px] flex-1">
                    <div className="absolute inset-y-0 left-[16px] flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Order ID/Customer..."
                        className="w-full h-[50px] pl-[48px] pr-4 py-[12px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] text-[16px] leading-[1.21em] font-normal text-[#F8FAFC] placeholder-[rgba(248,250,252,0.4)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                    />
                </div>

                {/* Dropdowns Container (30955:5708) */}
                <div className="flex items-center gap-[12px] w-full sm:w-auto">
                    {/* Dropdown 1 (30955:5710) - All dates */}
                    <button className="flex items-center justify-between w-full sm:w-[143px] h-[50px] pl-[15px] pr-[12px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] hover:bg-slate-800 transition-colors shrink-0">
                        <span className="text-[16px] font-normal leading-[1.21em] text-[#F8FAFC] truncate">All dates</span>
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>

                    {/* Dropdown 2 (30955:5719) - All status */}
                    <button className="flex items-center justify-between w-full sm:w-[138px] h-[50px] pl-[15px] pr-[12px] bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] hover:bg-slate-800 transition-colors shrink-0">
                        <span className="text-[16px] font-normal leading-[1.21em] text-[#F8FAFC] truncate">All status</span>
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>
                </div>
            </div>

            {/* Bottom Row - Action Button (Figma Node 30955:275) */}
            <div className="flex items-start">
                <button className="w-full sm:w-[140px] h-[50px] flex items-center justify-center bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] text-[16px] font-semibold text-[#F8FAFC] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] hover:bg-slate-800 transition-colors shrink-0">
                    Confirm (0)
                </button>
            </div>
        </div>
    )
}
