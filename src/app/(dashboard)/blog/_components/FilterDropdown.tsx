'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export interface Option {
    value: string
    label: string
}

interface FilterDropdownProps {
    value: string
    onChange: (val: string) => void
    options: Option[]
    placeholder: string
    className?: string
}

export function FilterDropdown({
    value,
    onChange,
    options,
    placeholder,
    className = ''
}: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedOption = options.find((opt) => opt.value === value)

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                className="w-full h-full appearance-none bg-[#1E293B] border border-[rgba(255,255,255,0.08)] rounded-[16px] pl-[48px] pr-[40px] text-[#F8FAFC] text-[16px] font-[400] leading-[1.2102272510528564em] outline-none text-left flex items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                {selectedOption ? selectedOption.label : placeholder}
            </button>
            <ChevronDown className="absolute right-[10px] top-[15px] w-[20px] h-[20px] text-[rgba(248,250,252,0.4)] pointer-events-none" />

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full z-50">
                    {/* SVG Arrow pointing up */}
                    <svg className="absolute -top-[6px] left-[22px] z-10" width="12" height="6" viewBox="0 0 12 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 0L12 6H0L6 0Z" fill="#1F2937" />
                    </svg>

                    {/* Dropdown Container */}
                    <div className="bg-[#1F2937] rounded-[8px] border border-[rgba(255,255,255,0.05)] shadow-[0px_8px_24px_0px_rgba(25,32,56,0.1)] py-[8px] flex flex-col w-full max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value)
                                    setIsOpen(false)
                                }}
                                className={`flex items-center px-[12px] py-[8px] cursor-pointer transition-colors ${value === opt.value ? 'bg-[#0B1120]' : 'hover:bg-[#0B1120]'
                                    }`}
                            >
                                <span className="text-[#FFFFFF] text-[14px] font-[400] leading-[1.5714285714285714em] truncate w-full">
                                    {opt.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
