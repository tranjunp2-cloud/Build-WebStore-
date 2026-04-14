# Phase 1: Setup Neon + Migrate Data

## Context
- Parent: [plan.md](plan.md)
- **Day 1** | **Priority:** P0 | **Status:** ⬜ pending

## Steps

### 1.1 Tạo Neon Account + Project
- [ ] Đăng ký https://neon.tech (dùng GitHub login)
- [ ] Tạo project: `primeweb-production`
- [ ] Region: **Singapore** (ap-southeast-1) — gần nhất với users MY/VN
- [ ] Lấy connection string: `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

### 1.2 Tạo Databases
- [ ] Tạo database `primeweb` (cho prime-web-v2)
- [ ] Tạo database `primebot` (cho prime-bot-assistant) — cùng project, $0

### 1.3 Export Data từ DO
```bash
# SSH vào DO hoặc dùng pg_dump từ connection string
pg_dump --no-owner --no-privileges \
  "postgresql://user:pass@do-host:25060/db?sslmode=require" \
  > backup.sql
```
- [ ] Export staging DB
- [ ] Export production DB (nếu có)
- [ ] Verify backup size < 512MB (Neon free limit)

### 1.4 Import Data vào Neon
```bash
psql "postgresql://user:pass@ep-xxx.neon.tech/primeweb?sslmode=require" \
  < backup.sql
```
- [ ] Import staging data
- [ ] Verify: `SELECT count(*) FROM users;` — match DO
- [ ] Verify: `SELECT count(*) FROM sites;` — match DO
- [ ] Verify: `SELECT count(*) FROM pages;` — match DO

### 1.5 Test Connection + SSL Strict
```bash
# Test từ local machine
psql "postgresql://user:pass@ep-xxx.neon.tech/primeweb?sslmode=require" \
  -c "SELECT version();"
```
- [ ] Connection works
- [ ] SSL mode correct
- [ ] Latency < 100ms

### 1.6 ⚠️ Test SSL Strict (Prediction Review item)
Neon có valid SSL cert → test với `rejectUnauthorized: true`:
```javascript
// Test script
const { Pool } = require('pg')
const pool = new Pool({
  connectionString: 'postgresql://user:pass@ep-xxx.neon.tech/primeweb?sslmode=require',
  ssl: { rejectUnauthorized: true } // STRICT — không chấp nhận self-signed
})
const res = await pool.query('SELECT version()')
console.log('SSL strict OK:', res.rows[0])
```
- [ ] `rejectUnauthorized: true` works với Neon → **bỏ `false` trong payload.config.ts**
- [ ] Nếu fail → giữ `false` tạm, log issue

## Dò Lỗi (Troubleshoot)

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `FATAL: password authentication failed` | Neon password sai | Reset password trong Neon dashboard |
| `SSL connection is required` | Thiếu `?sslmode=require` | Thêm vào connection string |
| `relation "xxx" does not exist` | Import không đầy đủ | Chạy lại pg_dump với `--no-owner` |
| `database "primeweb" does not exist` | Chưa tạo DB | `CREATE DATABASE primeweb;` trong Neon console |
| Storage > 512MB | Data quá lớn cho free tier | Upgrade Neon Launch ($19/mo) hoặc clean old data |

## Success Criteria
- [ ] 2 databases trên Neon, data đầy đủ
- [ ] Connection string hoạt động từ local
- [ ] Data match 100% với DO
