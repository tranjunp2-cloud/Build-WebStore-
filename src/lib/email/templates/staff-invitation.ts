/**
 * Staff Invitation email HTML template.
 * Sent when a user is invited to join a PrimeWeb workspace.
 */

export type EmailLocale = 'en' | 'ms'

interface StaffInvitationEmailData {
    userName: string
    workspaceName: string
    loginUrl?: string
    locale?: EmailLocale
}

export function staffInvitationEmail(data: StaffInvitationEmailData): { subject: string; html: string } {
    const { userName, workspaceName, loginUrl = 'https://primeweb.app/login', locale = 'en' } = data
    
    // Hardcoded en for now
    const subject = `You've been invited to join ${workspaceName} on PrimeWeb`
    const heading = 'Workspace Invitation'
    const subheading = 'Join your team on PrimeWeb'
    const greeting = 'Hello'
    const body = `You have been invited to join the workspace <strong>${workspaceName}</strong> as a staff member. Please log in to accept the invitation and access the workspace dashboard.`
    const cta = 'Log In to Accept'
    const footer = 'PrimeWeb \u00A9 2026. All rights reserved.'

    return {
        subject,
        html: `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0d9488, #6366f1); padding: 40px 32px; text-align: center;">
                <h1 style="color: white; font-size: 28px; margin: 0 0 8px;">${heading}</h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">${subheading}</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 16px;">${greeting} <strong>${userName}</strong>,</p>
                <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 24px;">
                    ${body}
                </p>

                <!-- CTA -->
                <div style="text-align: center;">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #0d9488, #0891b2); color: white; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none;">
                        ${cta}
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">${footer}</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
