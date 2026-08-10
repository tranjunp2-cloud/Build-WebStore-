import type { CollectionConfig } from "payload";

/** Server-owned fixture lease history; expiry/release is recorded rather than deleted. */
export const QaFixtureLeases: CollectionConfig = {
  slug: "qa_fixture_leases",
  admin: {
    useAsTitle: "fixtureKey",
    defaultColumns: ["fixtureKey", "environment", "status", "expiresAt"],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes("super-admin")),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "dispatch",
      type: "relationship",
      relationTo: "qa_smoke_dispatches",
      required: true,
      index: true,
    },
    {
      name: "environment",
      type: "select",
      required: true,
      options: ["staging"],
      index: true,
    },
    { name: "fixtureKey", type: "text", required: true, index: true },
    { name: "capacitySlot", type: "number", required: true, min: 1 },
    {
      name: "status",
      type: "select",
      required: true,
      options: ["active", "released", "expired"],
      index: true,
    },
    { name: "acquiredAt", type: "date", required: true },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "releasedAt", type: "date" },
  ],
  timestamps: true,
};
