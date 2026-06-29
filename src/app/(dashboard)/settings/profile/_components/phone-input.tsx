'use client'

import { Input } from '@/components/ui/input'
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select'

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

    function handleCodeChange(newCode: string) {
        onChange(`${newCode}${rest}`)
    }

    function handleRestChange(e: React.ChangeEvent<HTMLInputElement>) {
        const digits = e.target.value.replace(/\D/g, '')
        // Keep country code when user clears the number — schema allows code-only
        onChange(digits ? `${code}${digits}` : code)
    }

    return (
        <div className="flex gap-2 w-full">
            {/* Country code selector */}
            <Select value={code} onValueChange={handleCodeChange} disabled={disabled}>
                <SelectTrigger
                    aria-label="Country code"
                    className="h-[48px] w-auto flex-shrink-0 rounded-[8px] gap-1.5 px-2 shadow-[0px_1px_1px_rgba(0,0,0,0.1)]"
                >
                    <span className="text-xl leading-none select-none">{selected.flag}</span>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {COUNTRY_CODES.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.code} {c.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Phone number input */}
            <Input
                type="tel"
                inputMode="numeric"
                value={rest}
                onChange={handleRestChange}
                disabled={disabled}
                placeholder="123456789"
                aria-label="Phone number"
                className="h-[48px] rounded-[8px] text-[14px] flex-1 px-3 shadow-[0px_1px_1px_rgba(0,0,0,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
            />
        </div>
    )
}
