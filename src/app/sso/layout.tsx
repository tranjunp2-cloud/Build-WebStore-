import '@/app/globals.css'
import { I18nProvider } from '@/i18n'

export default function SsoLayout({ children }: { children: React.ReactNode }) {
    return <I18nProvider defaultLocale="en">{children}</I18nProvider>
}
