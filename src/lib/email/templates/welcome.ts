/**
 * Welcome email HTML template.
 * Sent when a new user registers on PrimeWeb.
 */

interface WelcomeEmailData {
    userName: string
    dashboardUrl?: string
}

export function welcomeEmail(data: WelcomeEmailData): { subject: string; html: string } {
    const { userName, dashboardUrl = 'https://primeweb.app/dashboard' } = data

    return {
        subject: 'Chào mừng đến PrimeWeb! 🎉',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0d9488, #6366f1); padding: 40px 32px; text-align: center;">
                <h1 style="color: white; font-size: 28px; margin: 0 0 8px;">Selamat Datang! 🎉</h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">Welcome to PrimeWeb</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 16px;">Xin chào <strong>${userName}</strong>,</p>
                <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 24px;">
                    Bạn đã sẵn sàng tạo website đầu tiên với PrimeWeb! 
                    Chỉ cần mô tả ý tưởng, AI sẽ giúp bạn xây dựng website chuyên nghiệp trong vài phút.
                </p>

                <!-- Steps -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <p style="font-size: 13px; text-transform: uppercase; color: #999; margin: 0 0 16px; font-weight: 600;">Bắt đầu trong 3 bước</p>
                    <div style="display: flex; margin-bottom: 12px;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: #0d9488; color: white; font-size: 13px; font-weight: 700; text-align: center; line-height: 28px; flex-shrink: 0;">1</div>
                        <p style="margin: 0; padding-left: 12px; font-size: 14px; line-height: 28px;">Mô tả website bạn muốn tạo</p>
                    </div>
                    <div style="display: flex; margin-bottom: 12px;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: #0d9488; color: white; font-size: 13px; font-weight: 700; text-align: center; line-height: 28px; flex-shrink: 0;">2</div>
                        <p style="margin: 0; padding-left: 12px; font-size: 14px; line-height: 28px;">Tùy chỉnh nội dung và thiết kế</p>
                    </div>
                    <div style="display: flex;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: #0d9488; color: white; font-size: 13px; font-weight: 700; text-align: center; line-height: 28px; flex-shrink: 0;">3</div>
                        <p style="margin: 0; padding-left: 12px; font-size: 14px; line-height: 28px;">Xuất bản và chia sẻ!</p>
                    </div>
                </div>

                <!-- CTA -->
                <div style="text-align: center;">
                    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #0d9488, #0891b2); color: white; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none;">
                        Bắt đầu ngay →
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">Powered by PrimeWeb — AI Website Builder cho SME Malaysia</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
