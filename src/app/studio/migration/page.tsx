import React from "react";
import { MigrationDiffClient } from "@/app/studio/qa/migration-diff/MigrationDiffClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Website Migration Audit (PW1 ➔ PW2) | Studio",
  description: "Trình đối soát 1-to-1 CSDL và giao diện 2.000 websites chuyển đổi từ Laravel MySQL sang Next.js 15 PostgreSQL Payload CMS.",
};

export default function StudioMigrationPage() {
  return <MigrationDiffClient />;
}
