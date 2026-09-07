import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/auth-guard";

export const dynamic = "force-dynamic";

export default async function StudioMigrationPage() {
  await requireSuperAdmin();
  redirect("/studio/qa/migration-diff");
}
