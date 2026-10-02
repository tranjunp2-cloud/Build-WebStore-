import { mergeFooterSocialsWithSite } from "@/lib/site-settings";
import { sql } from "drizzle-orm";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import {
  collectWebsiteMediaIds,
  resolveWebsiteMedia,
} from "./website-migration-media";
import {
  evidenceVersionSql,
  readWebsiteReview,
} from "./website-migration-review";

import {
  asRecord,
  asArray,
  text,
  compareMigrationContent,
  type MigrationField,
  type MigrationBlock,
  type MigrationPage,
  type MigrationStore,
} from "./website-migration-compare";
export type {
  MigrationField,
  MigrationBlock,
  MigrationPage,
  MigrationStore,
} from "./website-migration-compare";
async function execute<T>(
  payload: Payload,
  query: ReturnType<typeof sql>,
): Promise<T[]> {
  const db = payload.db.drizzle as unknown as {
    execute(query: unknown): Promise<{ rows: T[] }>;
  };
  return (await db.execute(query)).rows;
}
export async function readWebsiteMigrations(input: {
  batch?: string;
  run?: string;
  page: number;
  limit: number;
  search: string;
  status: string;
}) {
  const payload = await getPayload({ config });
  const batches = await execute<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    runId: string | null;
    part: string | null;
  }>(
    payload,
    sql`SELECT id,status,started_at AS "startedAt",finished_at AS "finishedAt", limits->'qaInput'->>'runId' AS "runId", limits->'qaInput'->>'part' AS part FROM pw1_migration_batches ORDER BY started_at DESC LIMIT 100`,
  );
  const where = sql`(${input.batch ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM pw1_migration_attempts x WHERE x.source_store_id=m.source_store_id AND x.batch_id=${input.batch ?? null}::uuid) OR EXISTS(SELECT 1 FROM pw1_migration_batches b CROSS JOIN LATERAL jsonb_array_elements(b.results) r WHERE b.id=${input.batch ?? null}::uuid AND r->>'sourceStoreId'=m.source_store_id))
        AND (${input.run ?? null}::text IS NULL OR EXISTS(SELECT 1 FROM pw1_migration_batches b WHERE b.limits->'qaInput'->>'runId'=${input.run ?? null} AND (EXISTS(SELECT 1 FROM pw1_migration_attempts x WHERE x.batch_id=b.id AND x.source_store_id=m.source_store_id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.results) r WHERE r->>'sourceStoreId'=m.source_store_id))))
        AND (${input.search}='' OR m.source_store_id ILIKE ${"%" + input.search + "%"} OR s.name ILIKE ${"%" + input.search + "%"})`;
  const rows = await execute<
    MigrationStore & {
      total: number;
      completed: number;
      published: number;
      needsAudit: number;
    }
  >(
    payload,
    sql`
        WITH catalog AS (
          SELECT m.source_store_id AS "storeId",s.name,m.site_id AS "siteId",m.status AS migration,
            (SELECT count(*)::integer FROM pages p WHERE p.site_id=m.site_id AND p.deleted_at IS NULL AND p.slug<>'404') AS "pageCount",
            CASE WHEN r.evidence_version=${evidenceVersionSql} THEN r.verdict ELSE 'unverified' END AS "qcStatus",r.reviewed_at AS "reviewedAt",
            s.status AS publish,CASE WHEN q.checked_at IS NOT NULL AND EXISTS(SELECT 1 FROM pages p WHERE p.site_id=m.site_id AND p.slug<>'404' AND (p.updated_at>q.checked_at OR EXISTS(SELECT 1 FROM jsonb_array_elements(q.report->'pages') version WHERE (version->>'pageId')::integer=p.id AND version->>'updatedAt' IS NOT NULL AND (version->>'updatedAt')::timestamptz<>p.updated_at))) OR q.checked_at IS NOT NULL AND s.updated_at>q.checked_at THEN 'stale' WHEN q.checked_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.report->'pages') version WHERE version->>'updatedAt' IS NOT NULL) THEN 'historical' ELSE COALESCE(q.report->>'status','not-checked') END AS "auditStatus",
            COALESCE((q.report->>'errors')::integer,0) AS errors,COALESCE((q.report->>'warnings')::integer,0) AS warnings,
            q.checked_at AS "checkedAt",('/sites/' || t.slug) AS url,m.updated_at AS "updatedAt"
          FROM pw1_migration_stores m JOIN sites s ON s.id=m.site_id JOIN tenants t ON t.id=m.tenant_id
          LEFT JOIN LATERAL (SELECT attempt_id FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1) c ON true
          LEFT JOIN pw1_migration_qa_audits q ON q.source_store_id=m.source_store_id AND q.input_hash=m.input_hash AND q.attempt_id=c.attempt_id
          LEFT JOIN LATERAL(SELECT * FROM pw1_migration_qa_reviews WHERE source_store_id=m.source_store_id ORDER BY reviewed_at DESC,id DESC LIMIT 1)r ON true
          WHERE ${where}
        ) SELECT *,count(*) OVER()::integer AS total, count(*) FILTER (WHERE migration='completed') OVER()::integer AS completed, count(*) FILTER (WHERE publish='published') OVER()::integer AS published, count(*) FILTER (WHERE "auditStatus" IN ('not-checked','historical','stale')) OVER()::integer AS "needsAudit" FROM catalog WHERE
          (${input.status}='all' OR ${input.status}='unpublished' AND publish<>'published' OR ${input.status}='failed' AND migration='failed' OR ${input.status}='attention' AND errors+warnings>0 OR ${input.status}='unaudited' AND "auditStatus" IN ('not-checked','historical','stale'))
        ORDER BY "storeId"::bigint LIMIT ${input.limit} OFFSET ${(input.page - 1) * input.limit}`,
  );
  return {
    batches,
    summary: {
      completed: rows[0]?.completed ?? 0,
      published: rows[0]?.published ?? 0,
      needsAudit: rows[0]?.needsAudit ?? 0,
    },
    stores: rows,
    total: rows[0]?.total ?? 0,
    page: input.page,
    limit: input.limit,
  };
}
export async function readWebsiteMigrationDetail(storeId: string) {
  const initialReview = await readWebsiteReview(storeId);
  const payload = await getPayload({ config });
  const rows = await execute<{
    siteId: number;
    tenantId: number;
    inputHash: string;
    attemptId: string | null;
    committedAt: string | null;
    artifacts: unknown;
    report: unknown;
    checkedAt: string | null;
    baseUrl: string | null;
  }>(
    payload,
    sql`
      SELECT m.site_id AS "siteId",m.tenant_id AS "tenantId",m.input_hash AS "inputHash",c.attempt_id AS "attemptId",c.committed_at AS "committedAt",a.artifacts,q.report,q.checked_at AS "checkedAt",q.base_url AS "baseUrl"
      FROM pw1_migration_stores m LEFT JOIN LATERAL (SELECT attempt_id,committed_at FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1) c ON true
      LEFT JOIN pw1_migration_attempts a ON a.id=c.attempt_id LEFT JOIN pw1_migration_qa_audits q ON q.source_store_id=m.source_store_id AND q.input_hash=m.input_hash AND q.attempt_id=c.attempt_id WHERE m.source_store_id=${storeId}`,
  );
  const row = rows[0];
  if (!row) return null;
  const site = await payload.findByID({
    collection: "sites",
    id: row.siteId,
    depth: 0,
    overrideAccess: true,
  });
  if (Number(asRecord(site.tenant).id ?? site.tenant) !== row.tenantId)
    throw new Error("Migration tenant mismatch");
  const tenant = await payload.findByID({
    collection: "tenants",
    id: row.tenantId,
    depth: 0,
    overrideAccess: true,
  });
  const currentPages = await payload.find({
    collection: "pages",
    where: { site: { equals: row.siteId } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const mediaIds = collectWebsiteMediaIds({ site, pages: currentPages.docs });
  const media = new Map<number, unknown>();
  for (let offset = 0; offset < mediaIds.length; offset += 100) {
    const result = await payload.find({
      collection: "media",
      where: { id: { in: mediaIds.slice(offset, offset + 100) } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: {
        url: true,
        alt: true,
        filename: true,
        mimeType: true,
        filesize: true,
        width: true,
        height: true,
      },
    });
    for (const item of result.docs) media.set(Number(item.id), item);
  }
  const artifacts = asRecord(row.artifacts),
    contract = asRecord(asRecord(artifacts["blueprint.json"]).nativeContract);
  const generated = asRecord(artifacts["ai-generated-before-media.json"]),
    applied = asRecord(
      artifacts["applied.json"] ?? artifacts["verified-candidate.json"],
    );
  const mappings = asArray(asRecord(applied.sourceMigration).pageMappings);
  const report = asRecord(row.report),
    auditPages = asArray(report.pages);
  const pages: MigrationPage[] = asArray(contract.pages).map((value) => {
    const source = asRecord(value),
      mapping = asRecord(
        mappings.find((item) => asRecord(item).sourceId === source.sourceId),
      );
    const snapshot = asRecord(
      asArray(applied.pages).find(
        (item) => asRecord(item).slug === source.slug,
      ),
    );
    const current = currentPages.docs.find((page) => page.id === snapshot.id);
    const expected = asRecord(
      asArray(generated.pages).find(
        (item) => asRecord(item).sourceId === source.sourceId,
      ),
    );
    const actual = asArray(resolveWebsiteMedia(current?.layout, media)),
      blocks = asArray(expected.blocks);
    const pageAudit = asRecord(
      auditPages.find((item) => asRecord(item).pageId === current?.id),
    );
    const groups = asArray(mapping.groups);
    const comparisons: MigrationBlock[] = asArray(source.components).map(
      (item) => {
        const component = asRecord(item),
          group = asRecord(
            groups.find((g) => asRecord(g).sourceId === component.sourceId),
          );
        const indexes = asArray(group.blockIndexes).filter((i): i is number =>
          Number.isInteger(i),
        );
        const fields = indexes.flatMap((index) => [
          {
            field: `block[${index}].blockType`,
            source: text(asRecord(blocks[index]).blockType),
            current: text(asRecord(actual[index]).blockType),
            status:
              !blocks[index] || !actual[index]
                ? ("unverified" as const)
                : asRecord(blocks[index]).blockType ===
                    asRecord(actual[index]).blockType
                  ? ("match" as const)
                  : ("mismatch" as const),
          },
          ...compareMigrationContent(
            blocks[index],
            actual[index],
            `block[${index}].`,
          ),
        ]);
        return {
          sourceId: String(component.sourceId),
          kind: String(component.kind),
          indexes,
          sourceContent: compareMigrationContent(
            component.block,
            component.block,
          ).map((f) => ({ field: f.field, value: f.source })),
          fields,
          status:
            !indexes.length || !fields.length
              ? "unverified"
              : indexes.some((index) => !actual[index]) ||
                  fields.some((f) => f.status === "mismatch")
                ? "mismatch"
                : fields.some((f) => f.status === "unverified")
                  ? "unverified"
                  : "match",
        };
      },
    );
    // Global navigation/footer are source-bound too, and must not disappear from QA.
    for (const [kind, index] of [
      ["navigation", 0],
      ["footer", blocks.length - 1],
    ] as const) {
      if (index < 0) continue;
      const currentBlock = asRecord(actual[index]);
      // Match the renderer fallback rather than certifying an omitted footer array.
      const resolvedBlock =
        kind === "footer" && currentBlock.blockType === "footer"
          ? {
              ...currentBlock,
              socials: mergeFooterSocialsWithSite(
                {
                  socials: Array.isArray(currentBlock.socials)
                    ? (currentBlock.socials as Array<{
                        platform: string;
                        url: string;
                      }>)
                    : undefined,
                },
                { socialLinks: site.socialLinks },
              ).socials,
            }
          : actual[index];
      const fields = compareMigrationContent(blocks[index], resolvedBlock);
      comparisons.push({
        sourceId: kind,
        kind,
        indexes: [index],
        sourceContent: compareMigrationContent(
          asRecord(contract.site)[kind],
          asRecord(contract.site)[kind],
        ).map((f) => ({ field: f.field, value: f.source })),
        fields,
        status: !fields.length
          ? "unverified"
          : !actual[index] || fields.some((f) => f.status === "mismatch")
            ? "mismatch"
            : fields.some((f) => f.status === "unverified")
              ? "unverified"
              : "match",
      });
    }
    const fields: MigrationField[] = ["title", "slug", "isHomepage"].map(
      (key) => ({
        field: key,
        source: text(source[key]),
        current: text(asRecord(current)[key]),
        status:
          source[key] === asRecord(current)[key]
            ? "match"
            : current
              ? "mismatch"
              : "unverified",
      }),
    );
    const stale =
      pageAudit.updatedAt &&
      current?.updatedAt &&
      new Date(String(pageAudit.updatedAt)).getTime() !==
        new Date(current.updatedAt).getTime();
    return {
      sourceId: String(source.sourceId),
      title: String(source.title),
      destinationId: current ? Number(current.id) : null,
      url: current
        ? `/sites/${encodeURIComponent(tenant.slug)}${current.isHomepage ? "" : "/" + current.slug}`
        : null,
      fields,
      blocks: comparisons,
      audit: row.report
        ? {
            status: String(pageAudit.status ?? "not-checked"),
            stale: Boolean(
              stale ||
              (row.checkedAt &&
                new Date(site.updatedAt).getTime() >
                  new Date(row.checkedAt).getTime()),
            ),
            versionVerified: Boolean(pageAudit.updatedAt),
            checkedAt: row.checkedAt,
            findings: asArray(pageAudit.findings).map((f) => {
              const finding = asRecord(f);
              return {
                code: String(finding.code),
                severity: String(finding.severity),
                detail: String(finding.detail),
                block:
                  typeof finding.block === "string" ? finding.block : undefined,
                viewport:
                  typeof finding.viewport === "number"
                    ? finding.viewport
                    : undefined,
              };
            }),
          }
        : null,
    };
  });
  // A concurrently committed rerun must not be presented with the previous source snapshot.
  const latest = await execute<{ inputHash: string; attemptId: string | null }>(
    payload,
    sql`SELECT m.input_hash AS "inputHash",c.attempt_id AS "attemptId" FROM pw1_migration_stores m LEFT JOIN LATERAL (SELECT attempt_id FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1) c ON true WHERE m.source_store_id=${storeId}`,
  );
  if (
    latest[0]?.inputHash !== row.inputHash ||
    latest[0]?.attemptId !== row.attemptId
  )
    throw new Error("Migration changed during evidence read; refresh");
  const settings: MigrationField[] = [
    {
      field: "name",
      source: text(asRecord(contract.site).name),
      current: text(site.name),
      status:
        asRecord(contract.site).name === site.name
          ? "match"
          : contract.site
            ? "mismatch"
            : "unverified",
    },
    ...Object.entries(asRecord(asRecord(contract.site).settings)).flatMap(
      ([group, value]) =>
        Object.entries(asRecord(value)).map(
          ([key, expected]): MigrationField => {
            const actual = asRecord(asRecord(site)[group])[key];
            return {
              field: `${group}.${key}`,
              source: text(expected),
              current: text(actual),
              status:
                expected === actual
                  ? "match"
                  : actual === undefined
                    ? "unverified"
                    : "mismatch",
            };
          },
        ),
    ),
  ];
  const review = await readWebsiteReview(storeId);
  if (initialReview?.version !== review?.version)
    throw new Error("Website changed during evidence read; refresh");
  return {
    storeId,
    siteId: row.siteId,
    name: site.name,
    inputHash: row.inputHash,
    attemptId: row.attemptId,
    committedAt: row.committedAt,
    checkedAt: row.checkedAt,
    sourceUrl: asRecord(contract.source).url ?? null,
    url: `/sites/${encodeURIComponent(tenant.slug)}`,
    pages,
    settings,
    warnings: asArray(artifacts["warnings.json"]).filter(
      (v): v is string => typeof v === "string",
    ),
    evidence: row.attemptId ? "available" : "unverified",
    review,
  };
}
