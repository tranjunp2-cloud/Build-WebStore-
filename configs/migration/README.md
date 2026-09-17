# PW1 exporter configs

`pw1-prod-20260916.json` selects all 93 CSV files of snapshot
`20260916-1351-1353` and preserves the approved mapping policies used for
`pw1-prod-20260917-classification-001`. It is a byte-for-byte copy of that
run's private source config, so its config hash is unchanged.

This file contains source labels, CSV filenames, domain suffixes, snapshot/time
settings, Store policy IDs and decision evidence. It contains no passwords,
credential keys, database connection strings or machine-specific paths.
`sourceInstanceToken` is an identity namespace, not an authentication token.

## Run on another machine

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

Exit 0 means mapping complete; exit 2 means the artifact still needs review;
exit 1 means invalid input/artifact or a failed run. Export is offline and needs
no DB connection, Payload server or importer credentials.

## Scope and changes

This is a frozen snapshot config, not a template for arbitrary production data.
It pins `asOf=2026-09-16T00:00:00Z`, UTC/+00:00, empty `nullTokens`, and the current
source/target suffixes. In particular, `targetPlatformSuffix` points to
`web-v2.dev.ecommercehub.my`; it is not an instruction to deploy to production.
Do not silently change timezone, asOf, namespace or policy to clear blockers.

A different snapshot or approved policy requires a separately reviewed config.
Changing even decision-evidence text changes provenance/policy hashes and may
require importer approval updates. Never add credentials, CSV data or generated
artifacts here; keep those in private locations outside Git.

See [the runbook](../../docs/runbooks/pw1-master-json-export.md).
