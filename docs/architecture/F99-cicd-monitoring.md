# Architecture: CI/CD, Security & Monitoring Flow
Date: 2026-03-11 | Related PRD: Infra/DevOps

## Overview
This document outlines the architecture for the CI/CD pipeline, automated security checks (DevSecOps), and system monitoring with real-time notifications to Lark. The goal is to ensure code quality, security, and high availability for the PrimeWeb project (Next.js 15 + Payload CMS + PostgreSQL).

## 1. CI/CD Pipeline Architecture
The pipeline is designed using **GitHub Actions** (or GitLab CI, adaptable) triggered on Pull Requests and Pushes to `main`.

### 1.1. CI Flow (Continuous Integration)
Trigger: `pull_request` to `main`
- **Step 1: Code Checkout & Cache Setup** (Node.js/npm cache)
- **Step 2: Lint & Typecheck**
  - Run `npm run typecheck` (TypeScript)
  - Run `npm run lint` (ESLint/Prettier)
- **Step 3: Security Checks (DevSecOps)**
  - **SAST:** Run SonarQube for static analysis (connected to `https://sonarqube.primecommerce.asia`).
  - **Dependency Scan:** Run `npm audit` or Dependabot/Snyk to find vulnerable packages.
  - **Secret Scan:** Run TruffleHog or Gitleaks to prevent hardcoded secrets.
- **Step 4: Unit & Integration Tests**
  - Run `npm test` (Vitest)
  - *Must pass the 10-Point Checklist requirements.*
- **Step 5: E2E Tests**
  - Run `npm run test:e2e` (Playwright) against a mocked/ephemeral environment.
- **Step 6: Notify Lark (CI Status)**
  - Send success/failure message to Lark group via Webhook.

### 1.2. CD Flow (Continuous Deployment)
Trigger: `push` to `main` (after PR merge)
- **Step 1: Build Docker Images**
  - Build `web` (Next.js + Payload) image.
- **Step 2: Push to Registry**
  - Push images to Docker Hub / GitHub Container Registry / AWS ECR.
- **Step 3: Deploy to Production**
  - SSH into production server and run `docker compose pull && docker compose up -d`.
  - Alternatively, trigger ArgoCD if using Kubernetes.
- **Step 4: Notify Lark (CD Status)**
  - Send deployment success/failure message with commit details and author.

## 2. Monitoring & Alerting Architecture
Monitoring covers application errors, server health, and business metrics.

### 2.1. Application Monitoring (Sentry)
- **Frontend & Backend Logging:** Integrate `@sentry/nextjs` to capture unhandled exceptions, API errors, and performance traces.
- **Alerting Rule:** Sentry configured to trigger a webhook when a new issue or high-error-rate spike occurs.
- **Notification:** Sentry Webhook -> Custom Integration/Zapier -> Lark Message.

### 2.2. Uptime & Server Health Monitoring
- **Uptime Robot / Better Uptime:** Ping the `NEXT_PUBLIC_SITE_URL` and database health check endpoints every 1-5 minutes.
- **Notification:** If down, send an alert immediately to the Lark "Incident Response" group.

### 2.3. Analytics / Business Metrics
- Key events tracking (`site_published`, `ai_builder_completed`) can be aggregated via PostHog or custom logging.
- Daily/Weekly rollup reports sent to Lark (optional).

## 3. Lark Notification Integration Format
All notifications to Lark will use the **Lark Custom Bot Webhook** with Interactive Message Cards.

**Example Message Card (Deployment Success):**
```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "content": "🚀 PrimeWeb Deployment Success", "tag": "plain_text" },
      "template": "green"
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "content": "**Commit:** [abcdef1](url)\n**Author:** Ben\n**Environment:** Production",
          "tag": "lark_md"
        }
      }
    ]
  }
}
```

## 4. 6-Layer Checklist Context
While this is an Infra feature, it touches several layers:
- [x] **Layer 2 — API/BACKEND:** Expose health check endpoints (`/api/health`) for Uptime monitoring.
- [x] **Layer 4 — SECURITY/AUTH:** Add SAST, Secret Scanning, and Dependency Scanning to pipeline. Sentry DSN and Lark Webhooks managed securely via `.env` or GitHub Secrets.
- [x] **Layer 5 — OPS/RELIABILITY:** Sentry setup, Docker-based deployment, Uptime monitoring.
- [x] **Layer 6 — BUSINESS:** Lark alerts ensure the team reacts quickly to downtime or critical bugs.

## 5. Tradeoffs / ADR
- **Action Runner vs Hosted:** Using GitHub-hosted runners initially for simplicity; can move to self-hosted runners if Docker builds become too slow/expensive.
- **Sentry -> Lark direct vs via Webhook Relay:** Sentry has native webhook support. An intermediate serverless function (e.g., Cloudflare Worker) might be needed to format Sentry's payload into Lark's specific Card schema.
