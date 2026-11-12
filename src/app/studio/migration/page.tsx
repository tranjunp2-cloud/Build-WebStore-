import { redirect } from "next/navigation";
import { requireStudioAccess } from "@/lib/admin/auth-guard";

export const dynamic = "force-dynamic";

export default async function StudioMigrationPage() {
  await requireStudioAccess();
  redirect("/studio/qa/migration-diff");
}
