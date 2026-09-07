import React from "react";
import { requireSuperAdmin } from "@/lib/admin/auth-guard";
import { MigrationDiffClient } from "./MigrationDiffClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Site Migration Diff Inspector (2,000 Sites) | Studio QA",
  description: "Trình đối soát 1-to-1 CSDL và giao diện 2.000 websites chuyển đổi từ Laravel MySQL sang Next.js 15 PostgreSQL Payload CMS.",
};

export default async function QaMigrationDiffPage() {
  await requireSuperAdmin();
  return <MigrationDiffClient />;
}
