/**
 * Email service utility.
 * Uses Resend API if RESEND_API_KEY is set, otherwise logs to console (dev mode).
 */

interface SendEmailOptions {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
    const resendKey = process.env.RESEND_API_KEY

    // If Resend API key is available, use it
    if (resendKey) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: process.env.EMAIL_FROM || 'PrimeWeb <noreply@primeweb.app>',
                    to: [to],
                    subject,
                    html,
                }),
            })

            if (!res.ok) {
                const error = await res.text()
                console.error('[Email] Resend error:', error)
                return false
            }

            console.log(`[Email] Sent to ${to}: ${subject}`)
            return true
        } catch (error) {
            console.error('[Email] Failed:', error)
            return false
        }
    }

    // Dev mode: log to console
    console.log(`\n📧 [DEV EMAIL] ────────────────────`)
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`HTML Length: ${html.length} chars`)
    console.log(`────────────────────────────────────\n`)
    return true
}
