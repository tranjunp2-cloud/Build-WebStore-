import { cookies } from 'next/headers'
import en from './locales/en.json'
import ms from './locales/ms.json'
import vi from './locales/vi'

type Locale = 'en' | 'ms' | 'vi'
const LOCALE_KEY = 'prefer_lang'
const locales = { en, ms, vi } as const

export async function getServerI18n() {
    const cookieStore = await cookies()
    const saved = cookieStore.get(LOCALE_KEY)?.value
    const locale: Locale = saved === 'en' || saved === 'ms' || saved === 'vi' ? saved : 'en'
    return { t: locales[locale], locale }
}
