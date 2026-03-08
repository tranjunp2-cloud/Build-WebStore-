# Luồng Deploy — Staging vs Production

> Tài liệu này mô tả quy trình deploy cho môi trường **staging** và **production**, đồng bộ với [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md).

---

## 1. Tổng quan

| Môi trường   | Nhánh Git | Workflow              | Mục đích                    |
|-------------|-----------|------------------------|-----------------------------|
| **Staging** | `staging` | `deploy-staging.yml`   | QA, demo, test trước prod   |
| **Production** | `main` | `deploy-production.yml` | Môi trường live cho user    |

- **CI** (`ci.yml`): chạy trên mọi PR và push vào `main` / `staging`: lint, typecheck, test, build.
- **Deploy Staging**: push lên `staging` → build → deploy lên môi trường staging.
- **Deploy Production**: push lên `main` → build → deploy lên production.

---

## 2. Luồng làm việc (flow)

```
feature/* → PR → main (sau khi review + CI pass)
                ↓
           Deploy Production chạy
                ↓
           Production được cập nhật

staging ← merge từ main (hoặc push trực tiếp khi cần test nhanh)
    ↓
Deploy Staging chạy
    ↓
Staging được cập nhật (QA/demo)
```

**Khuyến nghị:**

1. Feature dev trên `feature/*` → PR vào `main`.
2. Sau khi merge `main`, production tự deploy (nếu đã cấu hình bước deploy).
3. Cần môi trường staging: tạo nhánh `staging`, merge `main` vào `staging` (hoặc push `staging`), deploy staging chạy.

---

## 3. GitHub Actions đang dùng

| File | Trigger | Nội dung |
|------|---------|----------|
| `.github/workflows/ci.yml` | Push/PR vào `main`, `staging` | Lint, typecheck, test, build |
| `.github/workflows/deploy-staging.yml` | Push `staging` | Build + bước deploy staging (cấu hình thêm) |
| `.github/workflows/deploy-production.yml` | Push `main` | Build + bước deploy production (cấu hình thêm) |

---

## 4. Cấu hình deploy thực tế

Hiện tại bước **Deploy to Staging** / **Deploy to Production** chỉ in thông báo. Để deploy thật, tùy hạ tầng:

### 4.1 Docker + server (BytePlus ECS, VPS, …)

- Build image trong workflow, push lên registry.
- Trên server: pull image, chạy container (docker run / docker-compose).
- Có thể dùng SSH (key trong GitHub Secrets) hoặc Docker Registry.

### 4.2 Vercel

- Dùng `vercel deploy --prebuilt` sau bước build.
- Cấu hình token và project trong repo Secrets; tạo environment `staging` / `production` trên Vercel.

### 4.3 SSH + rsync / script

- Lưu host, user, key trong GitHub Secrets.
- Bước deploy: rsync `.next` và assets lên server, chạy script restart (pm2 / systemd / docker).

---

## 5. GitHub Environments & Secrets

- **Settings → Environments**: tạo `staging` và `production` (optional: protection rules, reviewers).
- **Settings → Secrets and variables → Actions**: thêm secrets (ví dụ `REGISTRY_PASSWORD`, `VERCEL_TOKEN`, `SSH_PRIVATE_KEY`, `STAGING_HOST`, `PROD_HOST`) và dùng trong workflow.

---

## 6. Checklist trước khi bật deploy thật

- [ ] Đã tạo nhánh `staging` (nếu dùng staging).
- [ ] Đã cấu hình GitHub Environments `staging` / `production` (nếu dùng).
- [ ] Đã thêm Secrets cần thiết cho bước deploy (registry, Vercel, SSH, …).
- [ ] Đã sửa bước "Deploy to Staging" / "Deploy to Production" trong workflow để gọi đúng lệnh/script (Docker, Vercel, SSH).
- [ ] Branch protection cho `main` (và `staging` nếu cần): require PR, approval, CI pass.
