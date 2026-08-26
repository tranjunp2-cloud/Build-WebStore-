import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer/SiteRenderer";
import { AppShell } from "@/components/AppShell";
import {
  C101_PAGES,
  C101_SITE,
  getC101Page,
} from "@/lib/static-prototypes/c101-fixture";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

type Props = { params: Promise<{ path?: string[] }> };

export default async function C101StaticPrototypeFixture({ params }: Props) {
  const { path = [] } = await params;
  const slug = path.length === 0 ? "/" : `/${path.join("/")}`;
  const page = getC101Page(slug);
  if (!page) notFound();

  return (
    <AppShell>
      <div data-static-prototype="c101" data-render-provenance="SiteRenderer">
        <SiteRenderer
          site={C101_SITE}
          page={page}
          pages={C101_PAGES}
          isEditor
          isOwner={false}
        />
      </div>
    </AppShell>
  );
}
