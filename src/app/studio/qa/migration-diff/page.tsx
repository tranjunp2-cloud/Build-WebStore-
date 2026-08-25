import React from "react";
import { MigrationDiffClient } from "./MigrationDiffClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Site Migration Diff Inspector (2,000 Sites) | Studio QA",
};

export default function QaMigrationDiffPage() {
  return <MigrationDiffClient />;
}
