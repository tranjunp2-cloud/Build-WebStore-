# Research: Bot CI Notify Codebase

## Current /api/ci/notify Implementation

**Location:** `/src/app/api/ci/notify/route.ts`

The endpoint accepts POST requests with Bearer token auth (validates against `CRON_SECRET`). Key features:

- **Normalization:** Converts flat payload from action.yml (e.g., `pr_number`, `ci_lint`, `deploy_status`) into nested CINotifyPayload objects (`pr.number`, `ci.lint`, `deploy.status`)
- **Validation:** Validates event type against allowed list: `deploy_success`, `deploy_fail`, `ci_pass`, `ci_fail`
- **Async Processing:** Returns 200 immediately; processes notification async via `handleCINotify()`
- **Error Handling:** Catches JSON parse errors, validates events, logs failures to bot-events
- **Duration Limit:** 30-second max execution time for Vercel

The normalizer is flexible—accepts either format (flat or nested), supporting both GitHub Actions (action.yml flat) and direct API calls.

## Lark Card Formatting

**Core Infrastructure:**

- **v2 Schema:** Cards use Lark v2.0 format with:
  - Header: title, subtitle, icon (standard_icon or custom_icon), text_tag_list (colored badges)
  - Body: vertical_spacing, padding, elements array
  - Markdown: text_size, text_align, color tags support

- **Card Builders:** Located in `/src/lib/lark/card-helpers.ts`
  - `cardV2()` — shell with header + body
  - `md()` — markdown text with size/align/color
  - `hr()` — horizontal separator
  - `container()` — div with bg color, border, radius, padding
  - `note()`, `columns()`, `actions()`, `button()`, `colored()`, `progressBar()`

- **CI/CD Templates:** (`ci-notify-service.ts`) build focused cards:
  - Deploy cards: hero summary, features (✨), bug fixes (🐛), test notes
  - CI fail cards: header with status, failed steps list, logs link
  - PR parsing: extracts Story/Changes/Test Plan sections from PR body

## Existing Patterns

**Payload Normalization:**
The `/api/ci/notify/route.ts` includes a comprehensive `normalizePayload()` function that:
- Maps flat fields → nested objects (pr_number → pr.number)
- Supports both action.yml format and nested API format
- Handles optional PR, CI, deploy, commit metadata
- Falls back gracefully (undefined if not provided)

**PR Body Parser:**
`parsePRBody()` extracts structured sections:
- Matches headers: `## Story`, `## Changes`, `## Test plan` (English + Vietnamese)
- Extracts bullet lists into features vs bug fixes
- Classifies changes by keywords (fix, sửa, bug)
- Returns ParsedPRBody interface

**Webhook Verification:**
Existing Lark webhook verification in `/src/lib/lark/crypto.ts`:
- `verifyEventSignature()` — validates HMAC-SHA256 of timestamp+nonce+encrypt_key+body
- Used by `/api/lark/events` for inbound Lark callbacks
- Uses constant-time comparison to prevent timing attacks

## Project Structure

```
/src
├── /app/api
│   ├── /ci/notify/route.ts          ← CI/CD endpoint
│   ├── /lark/events/route.ts        ← Lark webhook receiver
│   ├── /lark/actions/route.ts       ← Lark button/form actions
│   └── /lark/github-webhook/route.ts ← GitHub webhook (legacy)
├── /lib/lark
│   ├── ci-notify-service.ts         ← Card builders + PR parser
│   ├── card-helpers.ts              ← v2 card utilities
│   ├── cards.ts                     ← v1 card templates (legacy)
│   ├── client.ts                    ← Lark API client (sendCard, etc)
│   ├── crypto.ts                    ← HMAC verification
│   ├── constants.ts                 ← Config, repo aliases, bot commands
│   ├── types.ts                     ← TypeScript interfaces
│   └── github-service.ts            ← GitHub API wrapper
├── /lib/monitoring
│   └── bot-events.ts                ← Event logging
└── /lib/config
```

## Key Findings

- **No request signature verification on /api/ci/notify:** Relies only on Bearer token. GitHub Actions workflow will pass `BOT_SECRET` in Authorization header.
- **Flexible payload format:** Normalizer accepts flat (from action.yml) or nested payloads—supports gradual migration.
- **Card building is zero-LLM:** No AI calls; uses static templates with parsed PR body sections.
- **Markdown-first design:** Uses Lark markdown (`lark_md`) for rich text with colors, sizes, alignment.
- **Team notification via chat_id:** Cards sent to CI/CD group via `resolveNotificationChat()` which dynamically looks up team chat mapping.
- **Error logging:** Failed notifications logged via `logBotEvent()` for monitoring/debugging.
- **Multi-repo support:** Constants include repo alias system (web, bot, etc.) for handling multiple repos via single bot.

