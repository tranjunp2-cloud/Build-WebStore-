import React from "react";
import { requireSuperAdmin } from "@/lib/admin/auth-guard";
import { MigrationDiffClient } from "./MigrationDiffClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Site Migration Diff Inspector (2,000 Sites) | Studio QA",
};

export default async function QaMigrationDiffPage() {
  await requireSuperAdmin();
  return <MigrationDiffClient />;
}
