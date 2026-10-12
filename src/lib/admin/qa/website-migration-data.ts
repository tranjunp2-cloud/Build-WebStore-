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
  readWebsiteReviews,
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
import { sanitizeMigrationSourceUrl } from "./website-migration-url";
type WebsiteDocument = Awaited<ReturnType<Payload['findByID']>>;
import { summarizeWebsiteComparison, type WebsiteImageCheck } from './website-comparison-summary';
import { imagePreviews } from './website-image-preview';
import { websiteImageCacheKey } from './website-image-cache-key';
import { isF42SchemaReady } from './f42-source-readiness';
import { readFieldSummaries } from './f42-field-evidence-reader';
import { readWebsiteCatalogScope, websiteCatalogSources } from './website-migration-catalog';
import { F42CatalogScopeError } from './f42-source-contract';
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

type DetailRow = { storeId: string;
    siteId: number;
    tenantId: number;
    inputHash: string;
    attemptId: string | null;
    committedAt: string | null;
    artifacts: unknown;
    report: unknown;
    checkedAt: string | null;
    baseUrl: string | null;
    migration: string;
    publish: string;
  };
type DetailContext = {
  payload: Payload; rows: DetailRow[]; sites: WebsiteDocument[]; tenants: WebsiteDocument[]; pages: WebsiteDocument[];
  media: Map<number, unknown>; reviews: Awaited<ReturnType<typeof readWebsiteReviews>>;
};
export async function readWebsiteMigrations(input: {
  batch?: string;
  run?: string;
  page: number;
  limit: number;
  search: string;
  status: string;
  qc: string;
}) {
  const payload = await getPayload({ config });
  const scope = await readWebsiteCatalogScope(payload);
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
  const where = sql`(${input.batch ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM pw1_migration_attempts x WHERE x.source_store_id=source.source_store_id AND x.batch_id=${input.batch ?? null}::uuid) OR EXISTS(SELECT 1 FROM pw1_migration_batches b CROSS JOIN LATERAL jsonb_array_elements(b.results) r WHERE b.id=${input.batch ?? null}::uuid AND r->>'sourceStoreId'=source.source_store_id))
        AND (${input.run ?? null}::text IS NULL OR EXISTS(SELECT 1 FROM pw1_migration_batches b WHERE b.limits->'qaInput'->>'runId'=${input.run ?? null} AND (EXISTS(SELECT 1 FROM pw1_migration_attempts x WHERE x.batch_id=b.id AND x.source_store_id=source.source_store_id) OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.results) r WHERE r->>'sourceStoreId'=source.source_store_id))))
        AND (${input.search}='' OR source.source_store_id ILIKE ${"%" + input.search + "%"} OR COALESCE(s.name,'Website PW1 #' || source.source_store_id) ILIKE ${"%" + input.search + "%"} OR t.slug ILIKE ${"%" + input.search + "%"})`;
  const rows = await execute<
    MigrationStore & {
      total: number;
      completed: number;
      published: number;
      migrationIncomplete: number;
      unpublished: number;
      needsAttention: number;
      unverifiedQc: number;
      qcPassed: number;
      qcWarning: number;
      qcFailed: number;
      allTotal: number;
      notStarted: number;
      running: number;
      failed: number;
      catalogVersion: string;
    }
  >(
    payload,
    sql`
        WITH source_rows AS (${websiteCatalogSources(scope)}), sources AS (
          SELECT source_store_id,max(updated_at) AS updated_at FROM source_rows GROUP BY source_store_id
        ), catalog AS (
          SELECT source.source_store_id AS "storeId",COALESCE(s.name,'Website PW1 #' || source.source_store_id) AS name,m.site_id AS "siteId",COALESCE(m.status,'pending') AS migration,
            (s.id IS NOT NULL AND t.id IS NOT NULL) AS "canCompare",
            (SELECT count(*)::integer FROM pages p WHERE p.site_id=m.site_id AND p.deleted_at IS NULL AND p.slug<>'404') AS "pageCount",
            CASE WHEN r.evidence_version=${evidenceVersionSql} THEN r.verdict ELSE 'unverified' END AS "qcStatus",r.reviewed_at AS "reviewedAt",
            s.status AS publish,CASE WHEN q.checked_at IS NOT NULL AND EXISTS(SELECT 1 FROM pages p WHERE p.site_id=m.site_id AND p.slug<>'404' AND (p.updated_at>q.checked_at OR EXISTS(SELECT 1 FROM jsonb_array_elements(q.report->'pages') version WHERE (version->>'pageId')::integer=p.id AND version->>'updatedAt' IS NOT NULL AND (version->>'updatedAt')::timestamptz<>p.updated_at))) OR q.checked_at IS NOT NULL AND s.updated_at>q.checked_at THEN 'stale' WHEN q.checked_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.report->'pages') version WHERE version->>'updatedAt' IS NOT NULL) THEN 'historical' ELSE COALESCE(q.report->>'status','not-checked') END AS "auditStatus",
            COALESCE((q.report->>'errors')::integer,0) AS errors,COALESCE((q.report->>'warnings')::integer,0) AS warnings,
            q.checked_at AS "checkedAt",CASE WHEN s.id IS NOT NULL AND t.id IS NOT NULL THEN '/sites/' || t.slug ELSE NULL END AS url,COALESCE(m.updated_at,source.updated_at) AS "updatedAt"
          FROM sources source LEFT JOIN pw1_migration_stores m ON m.source_store_id=source.source_store_id
          LEFT JOIN sites s ON s.id=m.site_id AND s.tenant_id=m.tenant_id LEFT JOIN tenants t ON t.id=m.tenant_id
          LEFT JOIN LATERAL (SELECT attempt_id FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1) c ON true
          LEFT JOIN pw1_migration_qa_audits q ON q.source_store_id=m.source_store_id AND q.input_hash=m.input_hash AND q.attempt_id=c.attempt_id
          LEFT JOIN LATERAL(SELECT * FROM pw1_migration_qa_reviews WHERE source_store_id=m.source_store_id ORDER BY reviewed_at DESC,id DESC LIMIT 1)r ON true
          WHERE ${where}
        ), stats AS (
          SELECT count(*)::integer AS "allTotal", count(*) FILTER (WHERE migration='pending')::integer AS "notStarted", count(*) FILTER (WHERE migration='running')::integer AS running, count(*) FILTER (WHERE migration='failed')::integer AS failed, count(*) FILTER (WHERE migration='completed')::integer AS completed, count(*) FILTER (WHERE publish='published')::integer AS published, count(*) FILTER (WHERE migration<>'completed')::integer AS "migrationIncomplete", count(*) FILTER (WHERE publish<>'published')::integer AS unpublished, count(*) FILTER (WHERE "auditStatus" IN ('not-checked','historical','stale') OR errors+warnings>0)::integer AS "needsAttention", count(*) FILTER (WHERE "qcStatus"='unverified')::integer AS "unverifiedQc", count(*) FILTER (WHERE "qcStatus"='passed')::integer AS "qcPassed", count(*) FILTER (WHERE "qcStatus"='warning')::integer AS "qcWarning", count(*) FILTER (WHERE "qcStatus"='failed')::integer AS "qcFailed" FROM catalog
        ), catalog_version AS (
          SELECT md5(${scope?.sourceInstance ?? 'legacy'} || ':' || ${scope?.targetInstance ?? 'legacy'} || ':' ||
            COALESCE(string_agg("storeId" || ':' || migration || ':' || COALESCE("updatedAt"::text,''), ',' ORDER BY "storeId"),'')) AS "catalogVersion" FROM catalog
        ), filtered AS (
          SELECT * FROM catalog WHERE
            (${input.status}='all' OR ${input.status}='not_started' AND migration='pending' OR ${input.status}='running' AND migration='running' OR ${input.status}='completed' AND migration='completed' OR ${input.status}='incomplete' AND migration<>'completed' OR ${input.status}='unpublished' AND publish<>'published' OR ${input.status}='failed' AND migration='failed' OR ${input.status}='attention' AND (errors+warnings>0 OR "auditStatus" IN ('not-checked','historical','stale')) OR ${input.status}='unaudited' AND "auditStatus" IN ('not-checked','historical','stale'))
            AND (${input.qc}='all' OR "qcStatus"=${input.qc})
        ), filtered_stats AS (
          SELECT count(*)::integer AS total FROM filtered
        ) SELECT page.*,filtered_stats.total,stats.completed,stats.published,stats."migrationIncomplete",stats.unpublished,stats."needsAttention",stats."unverifiedQc",stats."qcPassed",stats."qcWarning",stats."qcFailed",stats."allTotal",stats."notStarted",stats.running,stats.failed,catalog_version."catalogVersion"
        FROM stats CROSS JOIN filtered_stats CROSS JOIN catalog_version
        LEFT JOIN LATERAL (
          SELECT filtered.*
          FROM filtered
          ORDER BY "storeId"::numeric,"storeId" LIMIT ${input.limit} OFFSET ${(input.page - 1) * input.limit}
        ) page ON true`,
  );
  const stores = rows.filter((row) => Boolean(row.storeId));
  const fieldSummaries: Awaited<ReturnType<typeof readFieldSummaries>> = scope ? await readFieldSummaries(stores.filter(store => store.canCompare).map(store => store.storeId), undefined, scope) : new Map();
  const websiteSummaries = await readWebsiteComparisonSummaries(payload, stores.filter(store => store.canCompare).map(store => store.storeId));
  // Scope/ownership can change while the catalog and evidence queries run.
  // Revalidate before publishing any rows so newly ambiguous bindings fail closed.
  const finalScope = await readWebsiteCatalogScope(payload);
  if (scope?.sourceInstance !== finalScope?.sourceInstance || scope?.targetInstance !== finalScope?.targetInstance) {
    throw new F42CatalogScopeError('SCOPE_CHANGED');
  }
  return {
    batches,
    catalogVersion: rows[0]?.catalogVersion ?? '',
    catalogScope: {
      kind: scope ? 'registered' : 'legacy_only',
      label: scope ? 'Website nguồn đã đăng ký trong F42 và website ledger' : 'Website đã ghi nhận trong website ledger',
      warning: scope ? 'Chỉ bao gồm nguồn đã đăng ký; không bao gồm website PW1 chưa từng được đăng ký với F42.' : 'Chưa có danh mục nguồn F42. Tổng chỉ bao gồm website ledger, không phải toàn bộ website PW1.',
    },
    summary: {
      lifecycle: { total: rows[0]?.allTotal ?? 0, not_started: rows[0]?.notStarted ?? 0, running: rows[0]?.running ?? 0, completed: rows[0]?.completed ?? 0, failed: rows[0]?.failed ?? 0 },
      completed: rows[0]?.completed ?? 0,
      published: rows[0]?.published ?? 0,
      migrationIncomplete: rows[0]?.migrationIncomplete ?? 0,
      unpublished: rows[0]?.unpublished ?? 0,
      needsAttention: rows[0]?.needsAttention ?? 0,
      unverifiedQc: rows[0]?.unverifiedQc ?? 0,
      qc: { passed: rows[0]?.qcPassed ?? 0, warning: rows[0]?.qcWarning ?? 0, failed: rows[0]?.qcFailed ?? 0, unverified: rows[0]?.unverifiedQc ?? 0 },
    },
    stores: stores.map(store => ({ ...store, fieldEvidence: fieldSummaries.get(store.storeId) ?? null, websiteComparison: websiteSummaries.get(store.storeId) ?? null })),
    total: rows[0]?.total ?? 0,
    page: input.page,
    limit: input.limit,
  };
}
export async function readWebsiteMigrationDetail(storeId: string, context?: DetailContext) {
  const initialReview = context ? context.reviews.find(r => r.storeId === storeId) ?? null : await readWebsiteReview(storeId);
  const payload = context?.payload ?? await getPayload({ config });
  const rows = context ? context.rows.filter(row => row.storeId === storeId) : await execute<DetailRow>(
    payload,
    sql`
      SELECT m.source_store_id AS "storeId",m.site_id AS "siteId",m.tenant_id AS "tenantId",m.input_hash AS "inputHash",m.status AS migration,s.status AS publish,c.attempt_id AS "attemptId",c.committed_at AS "committedAt",a.artifacts,q.report,q.checked_at AS "checkedAt",q.base_url AS "baseUrl"
      FROM pw1_migration_stores m JOIN sites s ON s.id=m.site_id LEFT JOIN LATERAL (SELECT attempt_id,committed_at FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1) c ON true
      LEFT JOIN pw1_migration_attempts a ON a.id=c.attempt_id LEFT JOIN pw1_migration_qa_audits q ON q.source_store_id=m.source_store_id AND q.input_hash=m.input_hash AND q.attempt_id=c.attempt_id WHERE m.source_store_id=${storeId}`,
  );
  const row = rows[0];
  if (!row) return null;
  const site = context ? context.sites.find(site => site.id === row.siteId) : await payload.findByID({
    collection: "sites",
    id: row.siteId,
    depth: 0,
    overrideAccess: true,
  });
  if (!site) return null;
  if (Number(asRecord(site.tenant).id ?? site.tenant) !== row.tenantId)
    throw new Error("Migration tenant mismatch");
  const tenant = context ? context.tenants.find(tenant => tenant.id === row.tenantId) : await payload.findByID({
    collection: "tenants",
    id: row.tenantId,
    depth: 0,
    overrideAccess: true,
  });
  if (!tenant) return null;
  const currentPages = context ? { docs: context.pages.filter(page => Number(asRecord(page.site).id ?? page.site) === row.siteId) } : await payload.find({
    collection: "pages",
    where: { site: { equals: row.siteId } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const mediaIds = collectWebsiteMediaIds({ site, pages: currentPages.docs });
  const media = context?.media ?? new Map<number, unknown>();
  for (let offset = 0; offset < (context ? 0 : mediaIds.length); offset += 100) {
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
  const auditStatus = !row.report
    ? "not-checked"
    : (() => {
        const checkedAt = row.checkedAt;
        if (!checkedAt) return String(report.status ?? "not-checked");
        const isStale = Boolean(
          new Date(site.updatedAt).getTime() > new Date(checkedAt).getTime() ||
              currentPages.docs.some((page) => {
                if (page.slug === "404") return false;
                const auditPage = asRecord(
                  auditPages.find((item) => asRecord(item).pageId === page.id),
                );
                return Boolean(
                  new Date(page.updatedAt).getTime() >
                    new Date(checkedAt).getTime() ||
                    (auditPage.updatedAt &&
                      new Date(String(auditPage.updatedAt)).getTime() !==
                        new Date(page.updatedAt).getTime()),
                );
              }),
        );
        if (isStale) return "stale";
        if (!auditPages.some((page) => asRecord(page).updatedAt))
          return "historical";
        return String(report.status ?? "checked");
      })();
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
    // Website rendering uses the site-wide footer; legacy inline footers may
    // omit fields (such as socials) that are preserved in the global JSON block.
    const currentLayout = asArray(current?.layout).map((value) => {
      const block = asRecord(value);
      return block.blockType === "footer" && asRecord(site.footerBlock).blockType === "footer"
        ? site.footerBlock
        : value;
    });
    const actual = asArray(resolveWebsiteMedia(currentLayout, media)),
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
    const targetPath = current ? (current.isHomepage ? '/' : `/${current.slug}`) : null;
    const menuLabels = targetPath ? asArray(asRecord(site.headerBlock).links)
      .map(asRecord)
      .filter(link => link.url === targetPath || link.url === `/sites/${tenant.slug}${targetPath === '/' ? '' : targetPath}`)
      .map(link => typeof link.label === 'string' ? link.label.trim() : '')
      .filter(Boolean) : [];
    const menuLabel = new Set(menuLabels).size === 1 ? menuLabels[0] : null;
    return {
      sourceId: String(source.sourceId),
      // Use the published PW2 menu label only for an exact target path match.
      title: current
        ? String(menuLabel || current.title || current.slug || 'Trang PW2')
        : 'Chưa có trang PW2',
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
  const latest = context ? [{ inputHash: row.inputHash, attemptId: row.attemptId }] : await execute<{ inputHash: string; attemptId: string | null }>(
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
  const review = context ? initialReview : await readWebsiteReview(storeId);
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
    sourceUrl: sanitizeMigrationSourceUrl(asRecord(contract.source).url),
    url: `/sites/${encodeURIComponent(tenant.slug)}`,
    pages,
    settings,
    warnings: asArray(artifacts["warnings.json"]).filter(
      (v): v is string => typeof v === "string",
    ),
    evidence: row.attemptId ? "available" : "unverified",
    migration: row.migration,
    publish: row.publish,
    auditStatus,
    review,
  };
}

/** Batch-load content for the visible catalog; never issue a detail query per store. */
async function readWebsiteComparisonSummaries(payload: Payload, storeIds: string[]) {
  const summaries = new Map<string, import('./website-comparison-summary').WebsiteComparisonSummary>();
  if (!storeIds.length) return summaries;
  const rows = await execute<DetailRow>(payload, sql`
    SELECT m.source_store_id AS "storeId",m.site_id AS "siteId",m.tenant_id AS "tenantId",m.input_hash AS "inputHash",
      m.status AS migration,s.status AS publish,c.attempt_id AS "attemptId",c.committed_at AS "committedAt",
      a.artifacts,q.report,q.checked_at AS "checkedAt",q.base_url AS "baseUrl"
    FROM pw1_migration_stores m JOIN sites s ON s.id=m.site_id
    LEFT JOIN LATERAL (SELECT attempt_id,committed_at FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1)c ON true
    LEFT JOIN pw1_migration_attempts a ON a.id=c.attempt_id
    LEFT JOIN pw1_migration_qa_audits q ON q.source_store_id=m.source_store_id AND q.input_hash=m.input_hash AND q.attempt_id=c.attempt_id
    WHERE m.source_store_id IN (${sql.join(storeIds.map(id => sql`${id}`), sql`,`)})`);
  const [sites, tenants, pages, reviews] = await Promise.all([
    payload.find({ collection: 'sites', where: { id: { in: rows.map(row => row.siteId) } }, depth: 0, pagination: false, overrideAccess: true }),
    payload.find({ collection: 'tenants', where: { id: { in: rows.map(row => row.tenantId) } }, depth: 0, pagination: false, overrideAccess: true }),
    payload.find({ collection: 'pages', where: { site: { in: rows.map(row => row.siteId) } }, depth: 0, pagination: false, overrideAccess: true }),
    readWebsiteReviews(storeIds),
  ]);
  const mediaIds = collectWebsiteMediaIds({ sites: sites.docs, pages: pages.docs });
  const media = new Map<number, unknown>();
  for (let offset = 0; offset < mediaIds.length; offset += 100) {
    const found = await payload.find({ collection: 'media', where: { id: { in: mediaIds.slice(offset, offset + 100) } }, depth: 0, pagination: false, overrideAccess: true,
      select: { url: true, alt: true, filename: true, mimeType: true, filesize: true, width: true, height: true, updatedAt: true } });
    for (const item of found.docs) media.set(Number(item.id), item);
  }
  const context: DetailContext = { payload, rows, sites: sites.docs, tenants: tenants.docs, pages: pages.docs, media, reviews };
  const details = await Promise.all(storeIds.map(id => readWebsiteMigrationDetail(id, context)));
  const imagePairs: Array<WebsiteImageCheck & { store: string; key: string }> = [];
  const mediaByUrl = new Map([...media.values()].map(value => [String(asRecord(value).url), asRecord(value)]));
  for (const detail of details) {
    if (!detail) continue;
    for (const page of detail.pages) for (const block of page.blocks) for (const field of block.fields) {
      const current = imagePreviews(field.field, field.current);
      for (const source of imagePreviews(field.field, field.source)) {
        const target = current.find(image => image.path === source.path);
        const item = target?.url ? mediaByUrl.get(target.url) : undefined;
        if (!source.url || !target?.url || !item?.id || !item.updatedAt) continue;
        imagePairs.push({ store: detail.storeId, page: page.sourceId, block: block.sourceId, field: field.field, path: source.path,
          key: websiteImageCacheKey(source.url, { id: Number(item.id), updatedAt: String(item.updatedAt) }, target.url),
          check: { status: 'unavailable', detail: 'Chưa có kiểm tra ảnh hợp lệ' }, altMatches: source.alt === target.alt,
          dimensionsMatch: source.width && source.height && target.width && target.height ? source.width === target.width && source.height === target.height : null });
      }
    }
  }
  const db = payload.db.drizzle;
  const checksReady = await isF42SchemaReady(db, { pw1_migration_qa_image_checks: ['cache_key', 'result', 'checked_at'] });
  const cached = checksReady && imagePairs.length ? await execute<{ key: string; result: WebsiteImageCheck['check'] }>(payload, sql`
    SELECT cache_key AS key,result FROM pw1_migration_qa_image_checks
    WHERE cache_key IN (${sql.join([...new Set(imagePairs.map(pair => pair.key))].map(key => sql`${key}`), sql`,`)})
    AND checked_at>now()-CASE WHEN result->>'status'='unavailable' THEN interval '5 minutes' ELSE interval '24 hours' END`) : [];
  const cachedByKey = new Map(cached.map(row => [row.key, row.result]));
  const reviewsReady = await isF42SchemaReady(db, { pw1_migration_qa_image_reviews: ['source_store_id', 'evidence_version', 'page_id', 'block_id', 'field_name', 'image_path'] });
  const imageReviews = reviewsReady ? await execute<{ store: string; version: string; page: string; block: string; field: string; path: string }>(payload, sql`
    SELECT source_store_id AS store,evidence_version AS version,page_id AS page,block_id AS block,field_name AS field,image_path AS path
    FROM pw1_migration_qa_image_reviews WHERE source_store_id IN (${sql.join(storeIds.map(id => sql`${id}`), sql`,`)})`) : [];
  // Refuse to publish a percentage if the source/current website changed during batch assembly.
  const latestReviews = new Map((await readWebsiteReviews(storeIds)).map(review => [review.storeId, review]));
  for (const detail of details) {
    if (!detail || detail.review?.version !== latestReviews.get(detail.storeId)?.version) continue;
    const checks = imagePairs.filter(pair => pair.store === detail.storeId && cachedByKey.has(pair.key))
      .map(pair => ({ ...pair, check: cachedByKey.get(pair.key)! }));
    const approvals = imageReviews.filter(review => review.store === detail.storeId && review.version === detail.review?.version);
    summaries.set(detail.storeId, summarizeWebsiteComparison(detail, checks, approvals));
  }
  return summaries;
}
