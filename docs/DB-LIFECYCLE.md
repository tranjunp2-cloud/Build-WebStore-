# DB Lifecycle — 3-Layer Rule

> Source of truth cho database deployment. Mọi thay đổi DB phải follow rule này.

---

## 3 Layers

```
Layer 1: Schema    — Tables + columns tồn tại         (auto, CI-gated)
Layer 2: Bootstrap — Data bắt buộc để app hoạt động    (auto, on startup)
Layer 3: Dev Seed  — Data cho dev/QC testing            (manual, khi cần)
```

---

## Layer 1: Schema (auto — `db-setup.js`)

**Files:** `scripts/db-setup.js`, `scripts/check-migrations.js`

| Thay đổi | Migration cần |
|----------|--------------|
| Collection mới | `CREATE TABLE IF NOT EXISTS` + thêm slug vào `COLLECTION_SLUGS[]` |
| Field mới | `ALTER TABLE ADD COLUMN IF NOT EXISTS` |
| Array field mới | `CREATE TABLE IF NOT EXISTS {collection}_{field}` |

CI tự block PR nếu thiếu migration.

---

## Layer 2: Bootstrap (auto — `db-setup.js` startup)

Chạy **mỗi lần Docker container start**. Tạo accounts bắt buộc nếu chưa có.

| Account | Env var email | Role |
|---------|--------------|------|
| Admin | `BOOTSTRAP_ADMIN_EMAIL` | super-admin |
| SSO Service | `SSO_SERVICE_EMAIL` | super-admin |

**Rules:**
- Email từ env vars — **KHÔNG hardcode**
- Idempotent — user đã tồn tại thì **skip, KHÔNG sửa roles** (tránh privilege escalation)
- Chỉ tạo user mới (email + role) — **KHÔNG set password** (SQL không hash được)
- Env var trống → skip (không crash)

**Security:**
- Existing user trùng email → chỉ log, không auto-nâng quyền
- Password PHẢI set qua Payload API (scrypt hash)

**Lần deploy đầu tiên:**
1. Set GitHub Secrets:
   ```bash
   gh secret set BOOTSTRAP_ADMIN_EMAIL -b "admin@primeweb.app"
   gh secret set SSO_SERVICE_EMAIL -b "sso-service@primeweb.app"
   gh secret set SSO_SERVICE_PASSWORD -b "strong-password"
   ```
2. Deploy → `db-setup.js` tự tạo user rows (email + role)
3. Chạy `npm run db:seed-sso` để set password đúng (Payload hash)

---

## Layer 3: Dev Seed (manual)

| Script | Mục đích |
|--------|---------|
| `npm run db:seed-sso` | Seed SSO + Admin accounts (Payload API, hash password đúng) |
| `POST /api/templates/seed?v3=true&force=true` | Seed industry templates (Bearer `SEED_TOKEN`; stamps `block_schema_version` sha256 on each row for drift detection — see `docs/architecture/F01-ai-builder.md` §5). Auto-called post-deploy via `.github/scripts/seed-templates-post-deploy.sh`. |

---

## Phân biệt lỗi DB

| Triệu chứng | Loại | Fix |
|-------------|------|-----|
| API 500 "column/table does not exist" | Schema Gap (L1) | Thêm migration vào `db-setup.js` |
| App chạy OK nhưng 0 users | Seed Gap (L2) | Check env vars + restart container |
| Thiếu test data | Dev Seed (L3) | Chạy seed script |

---

## Checklist thêm feature mới

```
☐ Collection/field mới → thêm migration db-setup.js (Layer 1)
☐ App cần account mới để hoạt động → thêm vào bootstrapSeed() (Layer 2)
☐ Dev/QC cần test data → tạo seed script riêng (Layer 3)
☐ Env vars mới → thêm vào .env.example + .env.staging.example + .env.production.example
☐ Credentials → KHÔNG hardcode, dùng env vars + GitHub Secrets
```
