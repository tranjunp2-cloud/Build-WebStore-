import React from 'react'
import { Search, ChevronDown } from 'lucide-react'

export function OrdersActionBar() {
    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full">
            {/* Left Group */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
                {/* Search Input */}
                <div className="relative w-full sm:max-w-[320px]">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Order ID/Customer..."
                        className="w-full h-[50px] pl-[48px] pr-4 py-3 bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-2xl text-base text-[#F8FAFC] placeholder-[rgba(248,250,252,0.4)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                    />
                </div>

                {/* Dropdowns */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button className="flex items-center justify-between w-full sm:w-[140px] h-[50px] px-4 bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-2xl hover:bg-slate-800 transition-colors">
                        <span className="text-base text-[#F8FAFC] truncate">All dates</span>
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>

                    <button className="flex items-center justify-between w-full sm:w-[140px] h-[50px] px-4 bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-2xl hover:bg-slate-800 transition-colors">
                        <span className="text-base text-[#F8FAFC] truncate">All status</span>
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>
                </div>
            </div>

            {/* Right Group - Action Button */}
            <button className="w-full md:w-auto h-[50px] px-6 bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-2xl text-base font-semibold text-[#F8FAFC] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] hover:bg-slate-800 transition-colors shrink-0">
                Confirm (0)
            </button>
        </div>
    )
}
