import React from "react";
import type { Metadata } from "next";
import { VisualCmsReviewClient } from "./VisualCmsReviewClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visual CMS Review | QA Control Center",
  description: "Visual review sandbox reproducing 100% merchant CMS views with live PR impact and defect warning overlays",
};

export default function VisualCmsReviewPage() {
  return <VisualCmsReviewClient />;
}
