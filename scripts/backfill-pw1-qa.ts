import { readdir, readFile } from "node:fs/promises";
import { resolve, basename, dirname } from "node:path";
import { Client } from "pg";
import { z } from "zod";
import { validateMigrationBatch } from "../src/lib/migration/pw1-batch-validation";
import { persistWebsiteAudits } from "../src/lib/migration/pw1-qa-audit-store";

const reportSchema = z.object({
  status: z.literal("completed"),
  createdAt: z.string().datetime(),
  baseUrl: z.string().url(),
  stores: z.array(
    z.object({
      storeId: z.string().regex(/^\d+$/),
      status: z.string(),
      errors: z.number().int().nonnegative(),
      warnings: z.number().int().nonnegative(),
      waitingBe: z.number().int().nonnegative(),
    }),
  ),
  pages: z.array(
    z.object({
      storeId: z.string().regex(/^\d+$/),
      pageId: z.number().int().positive().optional(),
      url: z.string().optional(),
      status: z.enum(["checked", "skipped", "failed"]),
      findings: z.array(
        z.object({
          code: z.string(),
          severity: z.enum(["error", "warning", "waiting-be"]),
          detail: z.string(),
          block: z.string().optional(),
          viewport: z.number().optional(),
        }),
      ),
    }),
  ),
});
async function walk(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    if (item.isSymbolicLink()) continue;
    const path = resolve(root, item.name);
    if (item.isDirectory()) files.push(...(await walk(path)));
    else if (
      item.name.endsWith(".migration-audit.json") ||
      item.name === "parts.jsonl"
    )
      files.push(path);
  }
  return files;
}
async function main() {
  const root = resolve(process.argv[2] ?? ".migration/runs"),
    files = await walk(root),
    client = new Client({
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL,
    });
  await client.connect();
  let reports = 0,
    batches = 0;
  try {
    for (const file of files.filter((p) => p.endsWith("parts.jsonl"))) {
      const events = (await readFile(file, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(
          (line) =>
            JSON.parse(line) as { event: string; time: string; path: string },
        );
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (event.event !== "started") continue;
        const end = events
          .slice(i + 1)
          .find((e) => e.event === "finished" && e.path === event.path);
        if (!end) continue;
        // Metadata only: never replace results or generate/publish a website.
        const runId = basename(dirname(dirname(event.path))),
          part = basename(event.path);
        const result = await client.query(
          `UPDATE pw1_migration_batches SET limits=limits || jsonb_build_object('qaInput',jsonb_build_object('runId',$3::text,'part',$4::text)) WHERE started_at>=$1::timestamptz AND started_at<$2::timestamptz AND limits->'qaInput' IS NULL`,
          [event.time, end.time, runId, part],
        );
        batches += result.rowCount ?? 0;
      }
    }
    for (const file of files.filter((p) =>
      p.endsWith(".migration-audit.json"),
    )) {
      const raw: unknown = JSON.parse(await readFile(file, "utf8"));
      if (
        !raw ||
        typeof raw !== "object" ||
        !("status" in raw) ||
        raw.status !== "completed"
      )
        continue;
      const report = reportSchema.parse(raw),
        input = file.slice(0, -".migration-audit.json".length);
      const parsed = validateMigrationBatch(
        JSON.parse(await readFile(input, "utf8")),
      );
      const attempts = (
        await client.query<{ source_store_id: string; attempt_id: string }>(
          `SELECT DISTINCT ON (source_store_id) source_store_id,attempt_id FROM pw1_migration_commits WHERE committed_at<=$1 ORDER BY source_store_id,committed_at DESC`,
          [report.createdAt],
        )
      ).rows;
      // Old reports have no captured page versions; F40 explicitly reports that limitation.
      await persistWebsiteAudits(
        parsed.entries,
        report,
        {},
        Object.fromEntries(
          attempts.map((a) => [a.source_store_id, a.attempt_id]),
        ),
      );
      reports++;
    }
    console.log(
      JSON.stringify({ reportsProcessed: reports, batchesLabelled: batches }),
    );
  } finally {
    await client.end();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Backfill failed");
    process.exit(1);
  });
