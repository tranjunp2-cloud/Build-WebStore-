import { Client } from "pg";
import { readWebsiteMigrationDetail } from "./website-migration-data";
import { imagePreviews } from "./website-image-preview";
export type ManualImageReview = {
  page: string;
  block: string;
  field: string;
  path: string;
  reviewerId: number;
  reviewedAt: string;
};
export async function websiteImageReviews(
  store: string,
  version: string,
  input?: {
    page: string;
    block: string;
    field: string;
    path: string;
    confirmed: boolean;
  },
  reviewerId?: number,
) {
  const detail = await readWebsiteMigrationDetail(store);
  if (!detail || detail.review?.version !== version)
    throw Error("EVIDENCE_CHANGED");
  if (input) {
    const field = detail.pages
      .find((p) => p.sourceId === input.page)
      ?.blocks.find((b) => b.sourceId === input.block)
      ?.fields.find((f) => f.field === input.field);
    if (
      !field ||
      !imagePreviews(field.field, field.source).some(
        (p) => p.path === input.path,
      )
    )
      throw Error("INVALID_IMAGE_FIELD");
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    if (input) {
      // Serialize against page/site edits while checking the current evidence revision.
      await client.query("BEGIN");
      await client.query(
        "SELECT s.id FROM sites s JOIN pw1_migration_stores m ON m.site_id=s.id WHERE m.source_store_id=$1 FOR SHARE OF s,m",
        [store],
      );
      await client.query(
        "SELECT p.id FROM pages p JOIN pw1_migration_stores m ON m.site_id=p.site_id WHERE m.source_store_id=$1 FOR SHARE OF p",
        [store],
      );
      const current = await readWebsiteMigrationDetail(store);
      if (current?.review?.version !== version) throw Error("EVIDENCE_CHANGED");
      const values = [
        store,
        version,
        input.page,
        input.block,
        input.field,
        input.path,
      ];
      if (input.confirmed)
        await client.query(
          `INSERT INTO pw1_migration_qa_image_reviews(source_store_id,evidence_version,page_id,block_id,field_name,image_path,reviewer_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source_store_id,evidence_version,page_id,block_id,field_name,image_path)
        DO UPDATE SET reviewer_id=EXCLUDED.reviewer_id,reviewed_at=now()`,
          [...values, reviewerId],
        );
      else
        await client.query(
          "DELETE FROM pw1_migration_qa_image_reviews WHERE source_store_id=$1 AND evidence_version=$2 AND page_id=$3 AND block_id=$4 AND field_name=$5 AND image_path=$6",
          values,
        );
      await client.query("COMMIT");
    }
    return (
      await client.query<ManualImageReview>(
        `SELECT page_id AS page,block_id AS block,field_name AS field,image_path AS path,reviewer_id AS "reviewerId",reviewed_at AS "reviewedAt" FROM pw1_migration_qa_image_reviews WHERE source_store_id=$1 AND evidence_version=$2`,
        [store, version],
      )
    ).rows;
  } catch (error) {
    if (input) await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
