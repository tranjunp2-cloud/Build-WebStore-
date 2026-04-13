'use client'

import { useEffect, useState } from 'react'

export function DashboardGreeting() {
    return (
        <div className="flex flex-col w-full m-0 p-0">
            <h1 className="m-0 p-0 text-[30px] font-bold leading-[36px] text-[#F8FAFC]">
                Welcome to PrimeWeb Dashboard
            </h1>
            <div className="m-0 p-0 mt-[8px] text-[14px] leading-[1.42em] text-[#F8FAFC]/60 max-w-[330px] sm:max-w-none">
                Monitor your store performance and manage your online business from one place.
            </div>
        </div>
    )
}
