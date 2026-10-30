import { redirect } from 'next/navigation'

export const metadata = { title: 'Settings' }

/** The only settings page so far is AI limits & prices. */
export default function SettingsPage() {
    redirect('/studio/settings/ai')
}
