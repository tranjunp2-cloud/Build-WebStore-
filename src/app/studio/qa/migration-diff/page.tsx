import React from "react";
import { requireSuperAdmin } from "@/lib/admin/auth-guard";
import { MigrationDiffClient } from "./MigrationDiffClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Website Migration QA | Studio QA",
  description: "Đối soát evidence migration PW1 sang PW2.",
};

export default async function QaMigrationDiffPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  await requireSuperAdmin();
  return (await searchParams).demo === "1" ? (
    <>
      <div className="bg-amber-950 px-6 py-3 text-sm text-amber-200">
        Giao diện demo / snapshot chưa xác minh. Không dùng số liệu này để duyệt
        kết quả migrate.{" "}
        <a href="/studio/qa/migration-diff" className="underline">
          Mở dữ liệu migration thật
        </a>
      </div>
      <MigrationDiffClient />
    </>
  ) : (
    <MigrationDiffClient live />
  );
}
