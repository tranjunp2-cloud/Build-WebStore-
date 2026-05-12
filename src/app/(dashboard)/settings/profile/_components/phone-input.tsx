'use client'

import { ChevronDown } from 'lucide-react'

type CountryCode = { code: string; flag: string; label: string }

const COUNTRY_CODES: CountryCode[] = [
    { code: '+60', flag: '🇲🇾', label: 'MY' },
    { code: '+84', flag: '🇻🇳', label: 'VN' },
]

function parsePhone(value: string): { code: string; rest: string } {
    for (const c of COUNTRY_CODES) {
        if (value.startsWith(c.code)) {
            return { code: c.code, rest: value.slice(c.code.length).replace(/\D/g, '') }
        }
    }
    return { code: '+60', rest: value.replace(/\D/g, '') }
}

type Props = {
    value: string
    onChange: (val: string) => void
    disabled?: boolean
}

export function PhoneInput({ value, onChange, disabled }: Props) {
    const { code, rest } = parsePhone(value)
    const selected = COUNTRY_CODES.find(c => c.code === code) ?? COUNTRY_CODES[0]

    function handleCodeChange(e: React.ChangeEvent<HTMLSelectElement>) {
        onChange(`${e.target.value}${rest}`)
    }

    function handleRestChange(e: React.ChangeEvent<HTMLInputElement>) {
        const rest = e.target.value.replace(/\D/g, '')
        onChange(rest ? `${code}${rest}` : '')
    }

    const inputBase = 'bg-[#0b1120] border border-[rgba(255,255,255,0.1)] rounded-[8px] h-[48px] text-[14px] text-white outline-none focus:border-blue-500/50 transition-colors shadow-[0px_1px_1px_rgba(0,0,0,0.1)]'

    return (
        <div className="flex gap-2 w-full">
            {/* Country code selector */}
            <div className={`${inputBase} relative flex items-center gap-1.5 px-1 flex-shrink-0`}>
                <span className="text-xl leading-none pointer-events-none select-none pl-1">{selected.flag}</span>
                <ChevronDown className="h-4 w-4 text-[rgba(248,250,252,0.5)] pointer-events-none flex-shrink-0" />
                <select
                    value={code}
                    onChange={handleCodeChange}
                    disabled={disabled}
                    aria-label="Country code"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full disabled:cursor-not-allowed"
                >
                    {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code} className="bg-[#1e293b]">
                            {c.flag} {c.code} {c.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Phone number input */}
            <input
                type="tel"
                inputMode="numeric"
                value={rest}
                onChange={handleRestChange}
                disabled={disabled}
                placeholder="123456789"
                aria-label="Phone number"
                className={`${inputBase} flex-1 px-3 placeholder-[rgba(159,159,169,1)] disabled:cursor-not-allowed disabled:opacity-60`}
            />
        </div>
    )
}
