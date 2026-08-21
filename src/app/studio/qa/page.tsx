import React from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { getQaControlCenterData } from "@/lib/admin/qa/control-center";
import { ProjectHealthClient } from "./ProjectHealthClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Health | QA Control Center",
};

export default async function QaProjectHealthPage() {
  const payload = await getPayload({ config });

  const initialData = await getQaControlCenterData(payload);

  return (
    <ProjectHealthClient
      initialData={initialData}
    />
  );
}
