# AI providers & models in Prime Studio (issue #2061 follow-up)

Owner (2026-10-30): stop editing Vercel env to change AI providers / models. Build all of it (incl. task routing +
runtime knobs). Design picked: wireframe option **B** (one focused page per section) with the section nav as a **left
rail like option A** — `/tmp/evon-design/ai-providers/wireframe.html?v=b` for page content, `?v=a` for the rail.

## Decisions

- Secrets live in **ai-platform's own DB** (never prime-web). AES-256-GCM; key = HKDF-SHA256(ikm =
  `AI_PROVIDER_SECRETS_KEY` if set else `AI_PLATFORM_CONTEXT_SECRET`, salt "ech-ai-platform", info
  "ai-provider-secrets-v1"). Each stored secret records `keyVersion` = first 8 hex of SHA-256(ikm). Mismatch → state
  `needs-reentry` (treated as no key), never a crash.
- Precedence per value: **Studio (ai-platform DB) → env → code default.** Env stays the bootstrap/fallback.
- ai-platform owns everything on the "Providers & models" tab: providers, endpoints, gateway, routing (tier chains,
  effort, timeout, image format), task → tier overrides, runtime knobs, history. Payload `ai_platform_config` keeps
  prices + caps; its `models` stays as a legacy fallback between Studio routing and env. The old "Model chains" card on
  the Limits & prices page is replaced by a link to Routing.
- Keys: write-only, last 4 chars + setBy/setAt kept; must pass a Test before save (UI), saved immediately (not via the
  save bar). History never stores secret values; restoring a version never restores keys.
- Changes apply within 60 s on every instance (settings cache 60 s; the instance that saved reloads at once).

## Contract — ai-platform internal admin API

Auth: `Authorization: Bearer <HS256 JWT>` signed with `AI_PLATFORM_CONTEXT_SECRET`, iss `prime-web`,
aud `ai-platform:internal`, sub `settings-admin`, ≤ 2 min old, claim `actor` = `{ id: string, email: string }`
(super-admin, verified by prime-web). 401 otherwise. All bodies JSON. Errors: 400/422 `{ errors: [{ path, message }] }`.

```
GET  /internal/settings                       → SettingsView
PUT  /internal/settings/providers/:id         { enabled?, baseUrl?: string|null, options?: {...} } → SettingsView
PUT  /internal/settings/providers/:id/key     { apiKey } → SettingsView        (also for endpoints: id "compat-<name>")
DELETE /internal/settings/providers/:id/key   → SettingsView
POST /internal/settings/providers/:id/test    { apiKey?, model? } → TestResult (apiKey = test before saving; rate 10/min)
POST /internal/settings/endpoints             { name, baseUrl, apiKey?, reasoning, structuredOutputs } → SettingsView
DELETE /internal/settings/endpoints/:name     → SettingsView
PUT  /internal/settings/gateway               { baseUrl: string|null, token?: string|null, paths: Record<provider,string> }
PUT  /internal/settings/routing               { tiers: { fast|balanced|quality: { chain: string[], effort, timeoutMs }, image: { chain: string[], timeoutMs, format } } }
PUT  /internal/settings/tasks                 { overrides: Record<taskId, "fast"|"balanced"|"quality"|null> }
PUT  /internal/settings/runtime               { values: Record<RuntimeKey, number|string|boolean|null> }   (null = back to env/default)
GET  /internal/settings/history?area=&limit=  → { entries: HistoryEntry[] }
POST /internal/settings/history/:id/restore   → SettingsView   (non-secret areas only)
```

```ts
type Source = "studio" | "env" | "default" | "none";
interface SettingsView {
  updatedAt: string | null;
  providers: Array<{ id: string /* openai|anthropic|google|deepseek|openrouter|typesafe|compat-<name> */,
    label: string, kind: "builtin" | "compat", enabled: boolean, enabledSource: Source,
    key: { state: "set" | "env" | "none" | "needs-reentry", last4: string | null, setBy: string | null, setAt: string | null },
    baseUrl: string | null, baseUrlSource: Source, defaultBaseUrl: string | null,
    options: { reasoning?: boolean, structuredOutputs?: boolean },
    lastTest: TestResult | null, models: string[] /* known models: price book + catalog + chains */ }>;
  gateway: { baseUrl: string | null, tokenSet: boolean, paths: Record<string, string>, source: Source };
  routing: { tiers: Record<"fast"|"balanced"|"quality", { chain: string[], chainSource: Source, effort: string | null,
               effortSource: Source, timeoutMs: number, timeoutSource: Source }>
             & { image: { chain: string[], chainSource: Source, timeoutMs: number, timeoutSource: Source, format: string | null, formatSource: Source } } };
  health: Record<"fast"|"balanced"|"quality"|"image", { serving: string | null /* provider:model */, state: "first-choice"|"fallback"|"down",
           skipped: Array<{ model: string, reason: "disabled"|"no-key"|"needs-reentry"|"last-test-failed"|"unknown-provider" }> }>;
  tasks: Array<{ id: string, group: string, label: string, defaultTier: string, override: string | null }>;
  runtime: Array<{ key: RuntimeKey, label: string, help: string, type: "int"|"enum"|"bool", min?: number, max?: number,
            options?: string[], value: number|string|boolean, source: Source, default: number|string|boolean, envName: string }>;
}
interface TestResult { ok: boolean, at: string, ms: number | null, model: string, code: "ok"|"invalid-key"|"quota"|"timeout"|"not-found"|"error", message: string }
interface HistoryEntry { id: string, at: string, actor: { id: string, email: string }, area: "providers"|"keys"|"endpoints"|"gateway"|"routing"|"tasks"|"runtime"|"restore",
  summary: string /* e.g. "Anthropic key replaced", "Quality chain: haiku → sonnet" */, restorable: boolean }
```

RuntimeKey (env name): runsPerDayPerShop (AI_DAILY_RUN_LIMIT_PER_ORG), tasksPerDayPerShop (AI_DAILY_TASK_LIMIT_PER_ORG),
runsPerMinutePerUser (AI_RUNS_PER_MINUTE_PER_USER), maxRunningPerUser, maxRunningPerShop, queueMaxWaitMs,
modelTimeoutMs (AI_MODEL_TIMEOUT_MS), runBudgetMs (AI_RUN_BUDGET_MS), threadRetentionDays, suggestMode, toolRouting,
logRequests. Validation: queueMaxWaitMs + runBudgetMs ≤ 290 000.

## prime-web

Super-admin routes `/api/admin/ai-providers/**` proxy 1:1 to the internal API above (sign the token with the session
user as `actor`), never log bodies. Studio pages under `/studio/settings/ai/models/{overview,providers,routing,tasks,runtime,history}`
with a left rail (badges = problems per section) + the "Limits & prices | Providers & models" tab bar on all AI settings pages.

## Phases / owners

| Phase | Owner |
|---|---|
| 01 ai-platform: settings store, crypto, internal API, registry/task/runtime wiring, test, history | `services/ai-platform/**` |
| 02 prime-web proxy + Studio pages | `src/app/api/admin/ai-providers/**`, `src/lib/admin/ai-providers/**`, `src/app/studio/settings/**`, tests |
| 03 E2E, docs, local CI, PR | lead |
