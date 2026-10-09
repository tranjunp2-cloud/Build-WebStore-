CREATE TABLE IF NOT EXISTS pw1_migration_qa_image_reviews (
 source_store_id text NOT NULL REFERENCES pw1_migration_stores(source_store_id),
 evidence_version text NOT NULL,
 page_id text NOT NULL,
 block_id text NOT NULL,
 field_name text NOT NULL,
 image_path text NOT NULL,
 reviewer_id integer NOT NULL REFERENCES users(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (source_store_id,evidence_version,page_id,block_id,field_name,image_path)
);
