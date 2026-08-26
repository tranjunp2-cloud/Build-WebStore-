import { NextResponse, type NextRequest } from "next/server";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const normalizedCode = (code || "").toLowerCase().trim();
    const fileName = TEMPLATE_FILE_MAP[normalizedCode];

    if (!fileName) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;"><h2>Template "${code}" not found</h2><p style="color:#94a3b8">Valid codes: ${Object.keys(TEMPLATE_FILE_MAP).join(", ")}</p></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const filePath = path.join(process.cwd(), "docs/design/Adapt template", fileName);

    if (!fs.existsSync(filePath)) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;"><h2>Template file missing on disk</h2></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const htmlContent = fs.readFileSync(filePath, "utf-8");

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;"><h2>Error loading template</h2><p style="color:#ef4444">${message}</p></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
