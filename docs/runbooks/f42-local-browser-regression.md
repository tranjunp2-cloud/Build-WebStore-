# F42 local Product description browser regression

`tests/f42-product-description-preservation.spec.ts` runs real authentication, OTP,
media upload, dashboard editing and save, and verifies the persisted Lexical document.
It covers unchanged rich text, text edited then reverted, and image-only descriptions.
Product setup uses SQL to isolate dashboard save from unrelated REST create hooks.

## Prerequisites

- An isolated PostgreSQL database named `pw1_gap_browser_<date>` on localhost,
  initialized with the current PW2 schema. Never point this test at production,
  staging, or the normal development database.
- Installed project dependencies and Playwright Chromium.
- Port 3000 available.

## Run

Use the same environment in both terminals running the Next server and Playwright:

- `DATABASE_URI`: connection URI for the isolated database above.
- `DATABASE_URL`: the same URI.
- `PAYLOAD_PUSH_SCHEMA=false`.
- `NEXT_PUBLIC_SERVER_URL=http://localhost:3000`.
- `E2E_SETUP_SECRET`: a fresh random value shared by server and test.
- `TEST_EMAIL`: a unique test address; `TEST_PASSWORD`: a fresh test password.
- `E2E_TEST_OTP_CODE=000000`.
- Clear `S3_BUCKET`, `S3_ENDPOINT`, `NEXT_PUBLIC_S3_ENDPOINT`, and `MAIL_HOST`.
- Set `SSO_API_BASE_URL=http://localhost:1` to prevent external notifications.

Set explicit empty values when overriding `.env.local`; merely unsetting a variable
allows Next to reload it from that file. Do not print secrets or include them in logs.

Start `npx next dev --port 3000`, then run:

```sh
npx playwright test --config playwright.f42-local.config.ts
```

The test validates the local database name before provisioning. Ensure the server
uses exactly the same database URI; the test cannot inspect the server environment.
It deletes the created products/media after assertions; its dedicated tenant and
user remain in the isolated database. Stop the server when finished. Payload may
regenerate the admin import map with S3 disabled; restore only those generated S3
handler changes, preserving any preexisting edits.

## Verified run: 2026-09-17

Passed: **1 test, 31.3 seconds** against `pw1_gap_browser_20260917`.
The real dashboard persisted name edits while retaining identical description JSON
for all three scenarios. The server was stopped and generated import map restored.
A local MinIO URL returned 404 during image preview because the public S3 endpoint
was inherited; this did not affect the persisted document assertions. Clear
`NEXT_PUBLIC_S3_ENDPOINT` as instructed above for subsequent runs.

## Required plan entitlement seed for a schema-only clone

A schema-only database has no plan feature data. Before starting the server, execute
this SQL **only on the dedicated local test database**. It mirrors the FREEMIUM
`product_management=YES` entry in `scripts/db-setup.js`; the provisioning endpoint
creates the tenant subscription but does not seed this entitlement.

```sql
DO $$ BEGIN
  IF current_database() !~ '^pw1_gap_browser_[0-9]+$' THEN
    RAISE EXCEPTION 'Expected isolated browser fixture database';
  END IF;
  INSERT INTO plans
    (code, name, description, price, currency, interval, interval_count, trial_period_days, sort_order)
  VALUES ('FREEMIUM', 'Freemium', 'Freemium plan', 0, 'MYR', 'month', 1, 0, 1)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO plan_features (plan_id, plan_code, feature_code, value)
  SELECT id, code, 'product_management', 'YES'
  FROM plans WHERE code = 'FREEMIUM'
  ON CONFLICT (plan_code, feature_code)
  DO UPDATE SET plan_id = EXCLUDED.plan_id, value = EXCLUDED.value;
END $$;
```

The verified run used an existing manually seeded `plan_features` row with
`plan_code=FREEMIUM`, `feature_code=product_management`, `value=YES`, and null
`plan_id`; no `plans` row existed. The complete seed above also adds the canonical
plan relation for reproducibility. A clean-schema run without this prerequisite
has **not** passed and can be denied by the Product feature gate.
