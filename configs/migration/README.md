# PW1 exporter configs

## Lệnh ngắn — tạo config và export trong một lần

```sh
npm run migrate:pw1 -- /path/to/csv --as-of 2026-09-18T00:00:00Z
```

Thay đường dẫn và mốc đối soát theo snapshot thực tế. Chạy từ root repo.
Script dùng `configs/migration/pw1-prod-profile.json`, tạo snapshot ID riêng cho lần
chạy và lưu `source-config.json` cùng `artifact/` trong `.migration/runs/<run-id>/`.
Mốc asOf không được suy từ tên CSV. Profile mặc định dùng UTC, giữ domain PW1 và
policy production đã chốt; dữ liệu nguồn khác cần `--profile <file>` phù hợp.
Có thể thêm `--snapshot-id <id>` để giữ định danh snapshot ổn định khi chạy lại,
hoặc `--output-dir <new-run-directory>` (thư mục cha có sẵn). Không ghi đè lần cũ.
Nếu export thất bại, thư mục lần chạy/config có thể còn để kiểm tra; không coi là
artifact hoàn tất. Lệnh này chỉ export offline, không nhập DB.


`pw1-prod-20260916.json` selects all 93 CSV files of snapshot
`20260916-1351-1353`. Its mapping policies and source-domain bindings include
subsequent approved decisions; it is no longer a byte-for-byte copy of the
historical `pw1-prod-20260917-classification-001` config. Use the config saved
with each run to reproduce that run's provenance and hash.

This file contains source labels, CSV filenames, domain suffixes, snapshot/time
settings, Store policy IDs and decision evidence. It contains no passwords,
credential keys, database connection strings or machine-specific paths.
`sourceInstanceToken` is an identity namespace, not an authentication token.

## New CSV export date

`pw1-prod-profile.json` keeps shared source identity, timezone, domain, approved
policy and the 93 required table names, without dated filenames, snapshotId or
asOf. Use it to generate a new exact source config:

```sh
npm run migrate:pw1:config -- \
  --input-dir /absolute/path/to/new-csv-snapshot \
  --profile configs/migration/pw1-prod-profile.json \
  --snapshot-id pw1-20260918-batch1 \
  --as-of 2026-09-18T00:00:00Z \
  --output /absolute/path/to/configs/pw1-20260918.json

npm run migrate:pw1:export -- \
  --input-dir /absolute/path/to/new-csv-snapshot \
  --source-config /absolute/path/to/configs/pw1-20260918.json \
  --output-dir /absolute/path/to/exports/new-run
```

Replace the example snapshot/asOf with the verified values for your export.
The output config parent must exist, be outside CSV input, and the output file
must not exist. Generated config is mode 0600. No database or source CSV is changed.

Supported filenames: `<table>_YYYYMMDD.csv`, `<table>_YYYYMMDDHHmm.csv`, or
`<table>_YYYYMMDDHHmmss.csv`; `_attributes__...csv` maps to `attributes`.
Subdirectories are allowed; symlinks are rejected. All required tables must have
exactly one CSV. Different minutes in the same date are accepted (as in the old
snapshot). Duplicate tables, different filename dates, invalid dates and
unexpected/undated CSVs fail instead of selecting the latest file. Put each
snapshot in its own directory; an intentionally cross-midnight export needs an
explicitly reviewed exact config rather than this automatic discovery.

**A matching filename date does not prove transactionally consistent data.**
The operator must confirm all files came from the same snapshot. This command
only validates names/config; exporter subsequently parses CSVs, validates policy
scope/relationships and hashes the exact input bytes. Generated config itself
is not an import-readiness certificate. Review snapshot-specific decisions such
as deferred Store323 before reuse; policy content is inherited without rewriting
its approval evidence. Changing it may require importer policy review.

## Run on another machine (frozen 2026-09-16 snapshot)


From the repository root, after installing the project dependencies with `npm ci`:

1. Transfer the unchanged CSV snapshot separately; CSV contents are not in Git.
2. Create a private output parent directory outside the CSV input directory.
3. Run (replace both absolute paths for your machine):

```sh
npm run migrate:pw1:export -- \
  --input-dir /absolute/path/to/DB_PROD \
  --source-config configs/migration/pw1-prod-20260916.json \
  --output-dir /absolute/path/to/exports/new-run
```

The output directory must not exist yet. This full production config has a
6 GiB resident-memory guard; provide RAM headroom above that guard and disk space
for the approximately 2.8 GB artifact plus temporary output and other inputs.
The guard is not a guarantee of peak RAM usage.

Validate the result:

```sh
node --max-old-space-size=8192 --import tsx scripts/data/export-pw1-master.ts \
  --validate-only --artifact-dir /absolute/path/to/exports/new-run
```

For the current contract, exit 0 means export or validation succeeded; data may
still be `partial`, and `importStatus=not_verified` does not certify DB readiness.
Read `master-manifest.json` and `export-review.md` for the outcome. Exit 1 means
invalid input/artifact or a failed run. Exit 2 applies only when validating a
historical contract that defined `needs_review`; it is not the current export
result. Export is offline and needs no DB connection, Payload server or importer
credentials.

## Scope and changes

This is a frozen snapshot config, not a template for arbitrary production data.
It pins `asOf=2026-09-16T00:00:00Z`, UTC/+00:00, empty `nullTokens`, and the current
source/target suffixes. In particular, `targetPlatformSuffix` points to
`web-v2.dev.ecommercehub.my`; it is not an instruction to deploy to production.
From contract 1.10.5, this field is retained for compatibility and no longer
constructs `sites.domain`: the exporter preserves the original live PW1 default
domain string. Tenant slug and custom-domain policies remain independent.
For a Store with multiple live default domains, configure `sourceDomainBindings`
at the source-config top level as Store ID → `store_domains.id`. Each selected
row must be live, default, and belong to that Store. Do not invent a choice; the
source-config hash records the reviewed selection.
The PROD configs retain the original domains approved on 2026-09-24:
Store `1327` selects domain row `1282`, and Store `1329` selects row `1182`.
The alternate `-2` domains are not selected for `sites.domain`.
Do not silently change timezone, asOf, namespace or policy to clear blockers.

A different snapshot or approved policy requires a separately reviewed config.
Changing even decision-evidence text changes provenance/policy hashes and may
require importer approval updates. Never add credentials, CSV data or generated
artifacts here; keep those in private locations outside Git.

See [the runbook](../../docs/runbooks/pw1-master-json-export.md).

## DEV CSV profile

`pw1-dev-profile.json` is for the separate PW1 development source. Run from the repository root:

```sh
npm run migrate:pw1 -- /home/liam/Documents/DB --profile configs/migration/pw1-dev-profile.json --as-of <snapshot-time-in-ISO-8601>
```

Replace the timestamp placeholder with the snapshot/backup reference time; filename dates do not establish it. The profile has no fixed filenames, snapshotId or asOf, so later CSV dates work with the same discovery checks. CSV input stays outside Git.

DEV identity is `PW1DEV` / `pw1-development-export`, with source domain suffix `web.dev.ecommercehub.my` and target suffix `web-v2.dev.ecommercehub.my`. Keep this namespace stable for this source; do not use it for PROD. UTC/+00:00 follows the checked local PW1 APP_TIMEZONE setting and DB_TIMEZONE default; confirm these if testing a backup from another environment.

The profile reuses the user's general mapping decisions and optional-history exclusions, but has no deferred Store IDs or siteType overrides. In particular, PROD's Store 323 deferral is not copied. This means its migrationPolicy hash differs from the PROD policy pinned by the importer: successful export does not approve the DEV policy for import. Importer policy validation must be handled explicitly before a DEV migration; do not rewrite hashes or bypass checks.

Local inspection found 93 CSVs dated 20260908, no missing/extra/duplicate tables, and 1,133 Store rows. These are inspection results, not a fixed snapshot requirement. Profile validation uses a temporary test timestamp only, not a verified snapshot time.
