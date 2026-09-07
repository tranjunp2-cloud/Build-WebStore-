import { NextResponse, type NextRequest } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEMPLATE_FILE_MAP: Record<string, string> = {
  fb101: "fb101-standalone-full.html",
  c101: "c101-standalone-full.html",
  c102: "c102-standalone-full.html",
  f102: "f102-standalone-full.html",
  fn101: "fn101-standalone-full.html",
  fn102: "fn102-standalone-full.html",
  fn103: "fn103-standalone-full.html",
  fn104: "fn104-standalone-full.html",
  pa101: "pa101-standalone-full.html",
};

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateFallbackTemplateHtml(code: string, version: "pw1" | "pw2"): string {
  const isPw1 = version === "pw1";
  const safeCode = escapeHtml(code.toUpperCase());
  const safeVersion = escapeHtml(version.toUpperCase());
  const badgeColor = isPw1 ? "#b45309" : "#0284c7";
  const bannerTitle = isPw1
    ? "👈 PW1 LARAVEL STOREFRONT (SNAPSHOT CSDL CŨ)"
    : "👉 PW2 NEXT.JS 15 STOREFRONT (BẢN MIGRATE MỚI)";
  const bgHeader = isPw1 ? "#1e293b" : "#0f172a";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template ${safeCode} (${safeVersion}) Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; }
    .version-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 99999; background: ${badgeColor}; color: #ffffff; padding: 8px 16px; font-size: 11px; font-weight: 700; text-align: center; letter-spacing: 0.5px; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
    .spacer { height: 36px; }
    header { background: ${bgHeader}; color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .nav a { color: #94a3b8; text-decoration: none; margin-left: 20px; font-size: 14px; font-weight: 500; }
    .hero { background: linear-gradient(135deg, ${isPw1 ? "#fef3c7" : "#e0f2fe"}, #ffffff); padding: 60px 32px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    .hero h1 { font-size: 32px; font-weight: 900; margin-bottom: 12px; color: ${isPw1 ? "#78350f" : "#0369a1"}; }
    .hero p { font-size: 15px; color: #64748b; max-width: 600px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; padding: 40px 32px; max-width: 1200px; margin: 0 auto; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .card-img { height: 160px; background: #f1f5f9; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #94a3b8; }
    .card h3 { font-size: 16px; margin-bottom: 8px; font-weight: 700; }
    .card .price { font-size: 15px; font-weight: 800; color: ${isPw1 ? "#b45309" : "#0284c7"}; }
    footer { background: #0f172a; color: #64748b; text-align: center; padding: 32px; font-size: 13px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="version-bar">${bannerTitle}</div>
  <div class="spacer"></div>
  <header>
    <div class="logo">STORE ${safeCode} (${isPw1 ? "Laravel Legacy" : "Next.js 15"})</div>
    <div class="nav">
      <a href="#">Trang Chủ</a>
      <a href="#">Sản Phẩm</a>
      <a href="#">Tin Tức</a>
      <a href="#">Liên Hệ</a>
    </div>
  </header>
  <div class="hero">
    <h1>Cửa Hàng Trực Tuyến ${safeCode}</h1>
    <p>Giao diện kiểm thử trực quan đối soát giữa bản cũ PW1 (PHP Laravel) và bản chuyển đổi PW2 (Next.js 15 Payload CMS).</p>
  </div>
  <div class="grid">
    <div class="card">
      <div class="card-img">Sản phẩm #1</div>
      <h3>Sản Phẩm Tiêu Biểu A</h3>
      <div class="price">180.000 ₫</div>
    </div>
    <div class="card">
      <div class="card-img">Sản phẩm #2</div>
      <h3>Sản Phẩm Cao Cấp B</h3>
      <div class="price">320.000 ₫</div>
    </div>
    <div class="card">
      <div class="card-img">Sản phẩm #3</div>
      <h3>Gói Combo Đặc Biệt C</h3>
      <div class="price">450.000 ₫</div>
    </div>
  </div>
  <footer>
    &copy; 2026 ECH Prime Web. Bản quyền thuộc về hệ sinh thái thương mại điện tử.
  </footer>
</body>
</html>`;
}

export const GET = withSuperAdmin(async (
  request: NextRequest,
  { params }: { params?: Record<string, string> }
) => {
  try {
    const code = params?.code || "";
    const normalizedCode = (code || "").toLowerCase().trim();
    const fileName = TEMPLATE_FILE_MAP[normalizedCode];

    const url = new URL(request.url);
    const rawVersion = (url.searchParams.get("version") || "pw1").toLowerCase().trim();
    const version: "pw1" | "pw2" = rawVersion === "pw2" ? "pw2" : "pw1";

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' data: https:; frame-ancestors 'self';",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "private, no-store, max-age=0",
    };

    if (!fileName) {
      const safeCode = escapeHtml(code);
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;"><h2>Template "${safeCode}" not found</h2><p style="color:#94a3b8">Valid codes: ${Object.keys(TEMPLATE_FILE_MAP).join(", ")}</p></body></html>`,
        { status: 404, headers }
      );
    }

    const filePath = path.join(process.cwd(), "docs/design/Adapt template", fileName);

    let htmlContent: string;
    if (fs.existsSync(filePath)) {
      htmlContent = fs.readFileSync(filePath, "utf-8");
      // Inject version indicator banner
      const isPw1 = version === "pw1";
      const bannerHtml = isPw1
        ? `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#b45309;color:#ffffff;padding:8px 16px;font-size:11px;font-family:sans-serif;font-weight:700;text-align:center;letter-spacing:0.5px;box-shadow:0 2px 10px rgba(0,0,0,0.25);">👈 PW1 LARAVEL (SNAPSHOT CSDL CŨ)</div><div style="height:34px;"></div>`
        : `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#0284c7;color:#ffffff;padding:8px 16px;font-size:11px;font-family:sans-serif;font-weight:700;text-align:center;letter-spacing:0.5px;box-shadow:0 2px 10px rgba(0,0,0,0.25);">👉 PW2 NEXT.JS 15 (BẢN MIGRATE MỚI)</div><div style="height:34px;"></div>`;

      if (htmlContent.includes("<body")) {
        htmlContent = htmlContent.replace(/<body[^>]*>/i, (match) => `${match}\n${bannerHtml}`);
      } else {
        htmlContent = `${bannerHtml}\n${htmlContent}`;
      }
    } else {
      // Vercel serverless fallback when docs directory is not bundled
      htmlContent = generateFallbackTemplateHtml(normalizedCode, version);
    }

    return new NextResponse(htmlContent, {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : "Internal Server Error";
    const safeMessage = escapeHtml(rawMessage);
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;"><h2>Error loading template</h2><p style="color:#ef4444">${safeMessage}</p></body></html>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }
});
