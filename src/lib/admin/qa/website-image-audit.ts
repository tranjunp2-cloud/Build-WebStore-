import { getPayload } from "payload";
import config from "@payload-config";
import { Client } from "pg";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { buildS3Client } from "@/lib/media/s3-client";
import { resolveAndValidate } from "@/lib/ai/url-scraper";
import { readWebsiteMigrationDetail } from "./website-migration-data";
import { imagePreviews } from "./website-image-preview";
import { compareImageBytes, type ImageCheck } from "./website-image-check";

const maxBytes = 20 * 1024 * 1024;
async function sourceBytes(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !url.hostname.endsWith(".digitaloceanspaces.com")
  )
    throw Error("Host ảnh nguồn chưa được cho phép; kiểm tra thủ công.");
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      resolveAndValidate(url.hostname),
      new Promise<never>((_, reject) => {
        dnsTimer = setTimeout(
          () => reject(Error("DNS ảnh nguồn timeout")),
          8000,
        );
      }),
    ]);
  } finally {
    clearTimeout(dnsTimer);
  }
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok || !response.body)
    throw Error(`Ảnh PW1: HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.startsWith("image/")) {
    await response.body.cancel();
    throw Error("Nguồn không trả về ảnh");
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel();
    throw Error("Ảnh vượt 20 MiB");
  }
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > maxBytes) {
      await response.body.cancel();
      throw Error("Ảnh vượt 20 MiB");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function destinationBytes(filename: string, prefix: string) {
  if (
    basename(filename) !== filename ||
    prefix.split("/").some((part) => part === "..")
  )
    throw Error("Đường dẫn media không hợp lệ");
  const storage = buildS3Client();
  if (!storage) {
    const path = resolve(
      process.env.VERCEL === "1" ? "/tmp/media" : "public/media",
      filename,
    );
    if ((await stat(path)).size > maxBytes) throw Error("Ảnh vượt 20 MiB");
    const bytes = await readFile(path);
    if (bytes.length > maxBytes) throw Error("Ảnh vượt 20 MiB");
    return bytes;
  }
  try {
    const response = await storage.client.send(
      new GetObjectCommand({
        Bucket: storage.bucket,
        Key: prefix ? `${prefix}/${filename}` : filename,
      }),
      { abortSignal: AbortSignal.timeout(8000) },
    );
    if (!response.Body || Number(response.ContentLength) > maxBytes)
      throw Error("Media thiếu hoặc vượt 20 MiB");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > maxBytes) throw Error("Ảnh vượt 20 MiB");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally {
    storage.client.destroy();
  }
}
export async function auditWebsiteImages(
  store: string,
  version: string,
  offset: number,
  force: boolean,
) {
  const detail = await readWebsiteMigrationDetail(store);
  if (!detail || detail.review?.version !== version)
    throw Error("EVIDENCE_CHANGED");
  const pairs = detail.pages.flatMap((page) =>
    page.blocks.flatMap((block) =>
      block.fields.flatMap((field) => {
        const source = imagePreviews(field.field, field.source),
          destination = imagePreviews(field.field, field.current);
        return [
          ...new Set([...source, ...destination].map((image) => image.path)),
        ].map((path) => {
          const left = source.find((image) => image.path === path),
            right = destination.find((image) => image.path === path);
          return {
            page: page.sourceId,
            block: block.sourceId,
            field: field.field,
            path,
            source: left?.url ?? null,
            destination: right?.url ?? null,
            altMatches: left && right ? left.alt === right.alt : null,
            dimensionsMatch:
              left?.width && left?.height && right?.width && right?.height
                ? left.width === right.width && left.height === right.height
                : null,
          };
        });
      }),
    ),
  );
  const selected = pairs.slice(offset, offset + 4);
  const payload = await getPayload({ config });
  const client = new Client({
    connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    const mapping = (
      await client.query<{ tenant_id: number }>(
        "SELECT tenant_id FROM pw1_migration_stores WHERE source_store_id=$1",
        [store],
      )
    ).rows[0];
    if (!mapping) throw Error("EVIDENCE_CHANGED");
    const filenames = selected.flatMap((pair) => {
      try {
        return pair.destination
          ? [
              decodeURIComponent(
                basename(
                  new URL(pair.destination, "https://relative.invalid")
                    .pathname,
                ),
              ),
            ]
          : [];
      } catch {
        return [];
      }
    });
    const mediaIds = filenames.length
      ? (
          await client.query<{ id: number }>(
            `SELECT DISTINCT m.id FROM media m JOIN pw1_migration_media cache ON cache.media_id=m.id WHERE cache.tenant_id=$1 AND m.filename=ANY($2::text[])`,
            [mapping.tenant_id, filenames],
          )
        ).rows.map((row) => row.id)
      : [];
    const docs = mediaIds.length
      ? (
          await payload.find({
            collection: "media",
            where: { id: { in: mediaIds } },
            pagination: false,
            depth: 0,
            overrideAccess: true,
          })
        ).docs
      : [];
    const output: Array<
      (typeof selected)[number] & {
        check: ImageCheck;
        cached: boolean;
        checkedAt: string;
      }
    > = [];
    // Two concurrent pairs; four per request keeps the route within maxDuration=60.
    const pendingChecks = new Map<string, Promise<ImageCheck>>();
    let cursor = 0;
    await Promise.all(
      [0, 1].map(async () => {
        while (cursor < selected.length) {
          const pair = selected[cursor++];
          let cached = false,
            checkedAt = new Date().toISOString(),
            check: ImageCheck;
          try {
            if (!pair.source || !pair.destination)
              throw Error("Thiếu URL ảnh nguồn hoặc đích");
            const media = docs.find((media) => media.url === pair.destination);
            if (!media?.filename)
              throw Error("Ảnh đích chưa resolve được vào media của store");
            const key = createHash("sha256")
              .update(
                JSON.stringify([
                  "image-v1",
                  pair.source,
                  media.id,
                  media.updatedAt,
                  pair.destination,
                ]),
              )
              .digest("hex");
            const prior = force
              ? undefined
              : (
                  await client.query<{ result: ImageCheck; checked_at: Date }>(
                    "SELECT result,checked_at FROM pw1_migration_qa_image_checks WHERE cache_key=$1 AND checked_at>now()-CASE WHEN result->>'status'='unavailable' THEN interval '5 minutes' ELSE interval '24 hours' END",
                    [key],
                  )
                ).rows[0];
            if (prior) {
              check = prior.result;
              cached = true;
              checkedAt = prior.checked_at.toISOString();
            } else {
              let pending = pendingChecks.get(key);
              cached = Boolean(pending);
              if (!pending) {
                pending = (async () => {
                  let result: ImageCheck;
                  try {
                    const [source, destination] = await Promise.all([
                      sourceBytes(pair.source!),
                      destinationBytes(
                        media.filename!,
                        typeof media.prefix === "string" ? media.prefix : "",
                      ),
                    ]);
                    result = await compareImageBytes(source, destination);
                  } catch (error) {
                    result = {
                      status: "unavailable",
                      detail:
                        error instanceof Error
                          ? error.message
                          : "Không kiểm tra được ảnh",
                    };
                  }
                  await client.query(
                    "INSERT INTO pw1_migration_qa_image_checks(cache_key,media_id,result) VALUES($1,$2,$3::jsonb) ON CONFLICT(cache_key) DO UPDATE SET result=EXCLUDED.result,checked_at=now()",
                    [key, media.id, JSON.stringify(result)],
                  );
                  return result;
                })();
                pendingChecks.set(key, pending);
              }
              check = await pending;
            }
          } catch (error) {
            check = {
              status: "unavailable",
              detail:
                error instanceof Error
                  ? error.message
                  : "Không kiểm tra được ảnh",
            };
          }
          output.push({ ...pair, check, cached, checkedAt });
        }
      }),
    );
    const current = await readWebsiteMigrationDetail(store);
    if (current?.review?.version !== version) throw Error("EVIDENCE_CHANGED");
    return {
      total: pairs.length,
      nextOffset: offset + selected.length,
      done: offset + selected.length >= pairs.length,
      results: output,
    };
  } finally {
    await client.end();
  }
}
