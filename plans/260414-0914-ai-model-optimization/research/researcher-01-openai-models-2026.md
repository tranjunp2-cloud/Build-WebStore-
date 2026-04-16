# OpenAI Model Landscape & Pricing — April 2026

Research date: 2026-04-14. Source-of-truth: openai.com/api/pricing, developers.openai.com/api/docs, pricepertoken.com, OpenAI dev community threads. Focus: replace hardcoded `gpt-4o` in ech-prime site-generation + edit-block flows.

## 1. Available API models (GA, April 2026)

ChatGPT simplified lineup (GPT-5.3/5.4) but API still exposes prior families. Retired in ChatGPT != retired in API.

**GPT-5 family (flagship, recommended default by OpenAI)**
- `gpt-5.4` — latest flagship, 1M ctx, reasoning-native, default `effort=none`
- `gpt-5.4-mini` — cheaper 5.4 sibling, same API shape
- `gpt-5.4-nano` — smallest 5.4
- `gpt-5.4-pro` — premium reasoning, expensive ($30/$180)
- `gpt-5` / `gpt-5-mini` / `gpt-5-nano` — original GPT-5 line, still on API
- `gpt-5.3-chat-latest`, `gpt-5.3-codex` — chat/code-tuned

**GPT-4.1 family (workhorse, still GA on API despite ChatGPT retirement 2026-02-13)**
- `gpt-4.1` — 1M ctx, no reasoning step, snappy
- `gpt-4.1-mini` — 1M ctx, strong instruction-following
- `gpt-4.1-nano` — cheapest capable model

**Legacy (GA on API, not retired yet from API surface)**
- `gpt-4o`, `gpt-4o-mini` — retired in ChatGPT, API still works but not recommended for new builds
- `o3`, `o4-mini` — reasoning models, still callable

Caveat: GPT-5 was 2025 H2, GPT-5.4 is current flagship in 2026. OpenAI typically keeps API models ~12mo post ChatGPT retirement; new integrations should avoid `gpt-4o`.

## 2. Pricing per 1M tokens (USD, standard tier)

| Model | Input | Cached in | Output | Notes |
|---|---|---|---|---|
| gpt-5.4 | 2.50 | 0.25 | 15.00 | flagship, 1M ctx |
| gpt-5.4-mini | 0.75 | 0.075 | 4.50 | |
| gpt-5.4-nano | 0.20 | 0.02 | 1.25 | |
| gpt-5.4-pro | 30.00 | — | 180.00 | avoid for prod scale |
| gpt-5 | 0.625 | 0.125 | 5.00 | cheaper than 5.4, older gen |
| gpt-5-mini | 0.125 | 0.025 | 1.00 | very cheap but see §5 |
| gpt-5-nano | 0.050 | 0.005 | 0.40 | |
| gpt-4.1 | 2.00 | 0.50 | 8.00 | |
| **gpt-4.1-mini** | **0.20** | **0.10** | **0.80** | workhorse |
| gpt-4.1-nano | 0.050 | 0.025 | 0.20 | cheapest capable |
| gpt-4o (current) | 2.50 | 1.25 | 10.00 | baseline |
| gpt-4o-mini | 0.15 | 0.075 | 0.60 | |
| o3 | 2.00 | 0.50 | 8.00 | reasoning |
| o4-mini | 1.10 | 0.275 | 4.40 | reasoning |

Batch API = 50% off all columns. Regional residency = +10%.

## 3. Cost math for our two workloads

**Site-gen** (4K in / 8K out, no cache hit assumed):
- gpt-4o (today): 4k×2.50 + 8k×10 = $0.010 + $0.080 = **$0.090 / call**
- gpt-4.1-mini: 4k×0.20 + 8k×0.80 = $0.0008 + $0.0064 = **$0.0072 / call** (12.5× cheaper)
- gpt-5-mini: 4k×0.125 + 8k×1.00 = $0.0005 + $0.008 = **$0.0085 / call**
- gpt-5.4-mini: 4k×0.75 + 8k×4.50 = $0.003 + $0.036 = **$0.039 / call** (2.3× cheaper)
- gpt-5.4: 4k×2.50 + 8k×15 = $0.010 + $0.120 = **$0.130 / call** (1.4× MORE)
- gpt-4.1-nano: 4k×0.05 + 8k×0.20 = **$0.0018 / call** (50× cheaper, quality risk)

**Edit-block** (1.5K in / 1.5K out):
- gpt-4o (today): 1.5k×2.50 + 1.5k×10 = **$0.01875 / call**
- gpt-4.1-mini: **$0.0015** (12.5× cheaper)
- gpt-5-mini: **$0.00169**
- gpt-4.1-nano: **$0.000375** (50× cheaper)
- gpt-5.4-mini: **$0.0079**

At 1K site-gens + 10K edit-blocks per month (rough MVP scale):
- Today: ~$90 + ~$188 = **~$278/mo**
- gpt-4.1-mini everywhere: ~$7.2 + ~$15 = **~$22/mo**
- gpt-5.4-mini site-gen + gpt-4.1-mini edit: ~$39 + ~$15 = **~$54/mo**

## 4. Structured Outputs (`json_schema` strict)

- Full strict `response_format: { type: 'json_schema', strict: true, schema }` supported on: gpt-4o-2024-08-06+, gpt-4o-mini, **all gpt-4.1 family**, **all gpt-5 / 5.3 / 5.4 family**, o3, o4-mini.
- Earliest `gpt-4.1` shipped returned "Unsupported model" on json_schema chat-completions; fixed — confirmed working via Responses API + latest API versions (2025-03-01-preview+).
- `json_object` (loose) works on everything but no schema validation.
- **Known weakness — gpt-5-mini**: multiple dev-community reports of schema violations on nested JSON, especially with long structured outputs. Users explicitly downgrading to gpt-4.1-mini. gpt-5.4-mini appears to have fixed this but no head-to-head data on deep nesting yet.
- **gpt-4.1-mini is the empirical leader** for "nearly always valid on 30K+ calls" per community testing. Our site-gen schema (multi-page, 10-15 nested blocks each with typed content) is exactly the danger zone.

## 5. Reasoning effort control

- `reasoning.effort` parameter supported on **all gpt-5 family + o3/o4-mini**.
- Values: `none | minimal | low | medium | high | xhigh` (model-dependent subset).
- gpt-5.4 defaults to `none` (acts like a chat model); prior gpt-5 defaults to `medium`.
- **Minimal/none** = no reasoning tokens, fastest TTFT, cheap. Best for "deterministic extraction, formatting, short rewrites" — directly matches edit-block.
- Higher effort = more hidden reasoning tokens billed as output. Can 3-5× output cost silently.
- gpt-4.1 family has **no reasoning step at all** — cheaper & more predictable billing, but no upside from "think harder" toggle.

## 6. Benchmarks — instruction following & JSON for small models

- IFEval (instruction following): gpt-4.1 = 87.4, gpt-4o = 81.0. gpt-4.1-mini beats gpt-4o overall on IFEval (49% → improvement from 29% on harder "multi-instruction" subset).
- gpt-4.1-mini "matches gpt-4o reasoning, ~half latency, fraction of cost" — OpenAI's own positioning.
- Creative variety: no public benchmark. Community sentiment: gpt-5 family is MORE uniform / less varied at temp 0.7 than gpt-4o; gpt-4.1 family closer to gpt-4o vibe. For template/variety-sensitive site-gen this matters.
- gpt-5.4-mini DataCamp review: strong on tool-use + structured output, positioned as gpt-4o-mini replacement.
- gpt-5-mini specifically flagged by community as regressing on structured JSON vs gpt-4.1-mini — DO NOT pick for site-gen without A/B.

## 7. Vercel AI Gateway (routing / fallback / observability)

- **Zero markup** on tokens (matches direct OpenAI pricing, even BYOK). Pay-as-you-go.
- Supports 20+ providers (OpenAI, Anthropic, Google, xAI, Meta…).
- **Fallback routing**: `providerOptions.gateway.models: [primary, fallback1, fallback2]` — tries in order until success. Automatic fallback on provider outage.
- OpenAI `service_tier` param passthrough (flex / priority) — auto-adjusts billing.
- Unified observability: per-request latency, tokens, cost, model. Logs + dashboards built-in.
- Integrates cleanly with Vercel AI SDK (`ai` + `@ai-sdk/openai` + `@ai-sdk/gateway`). We're already on Vercel — this is the free-est win.
- Caveat: BYOK means you still pay OpenAI directly; gateway just routes. Without BYOK you pay OpenAI rate via Vercel billing.

## 8. Recommendations

### Flow 1 — Site generation (creative, nested JSON, 4k/8k)
- **Primary: `gpt-4.1-mini`** — strongest JSON schema reliability on nested outputs, 12.5× cheaper than gpt-4o, instruction-following beats gpt-4o, no hidden reasoning-token billing, 1M ctx headroom. Use `response_format: { type: 'json_schema', strict: true, schema }` — migrate off `json_object`.
- **Fallback: `gpt-5.4-mini`** — if quality A/B shows variety/creativity drop vs gpt-4o. Still 2.3× cheaper than gpt-4o, reasoning-capable (set `effort: 'low'` to cap costs). Use via Vercel AI Gateway fallback array.
- **Avoid for site-gen**: gpt-5-mini (nested JSON regressions), gpt-4.1-nano (untested at this output length), gpt-4o (keep only as third-tier fallback during transition).
- Keep `temperature: 0.7` for variety. Consider upping to 0.8 on gpt-5.x if variety drops.

### Flow 2 — Edit-block (instruction-driven, small JSON, 1.5k/1.5k)
- **Primary: `gpt-4.1-mini`** — same reliability story, edit-block is easier than site-gen so cheaper is safe. $0.0015/call is negligible.
- **Fallback: `gpt-4.1-nano`** — 4× cheaper again ($0.000375/call). At this output size and a schema-strict constraint, nano is likely sufficient for "apply instruction to known block shape". A/B required.
- Optional: `gpt-5.4-mini` with `reasoning.effort: 'minimal'` if nuanced instructions (e.g. "make this more playful but keep brand voice") show weakness on 4.1-mini.
- Reduce `temperature` to 0.3–0.5 — edit-block wants fidelity, not variety.

### Architecture
- Route through **Vercel AI Gateway** (zero markup, we're already on Vercel). Use AI SDK `generateObject()` with Zod schema instead of raw `json_object` — gives us both typed parse + strict mode.
- Config model as env var / per-flow constant, NOT hardcoded. e.g. `AI_MODEL_SITEGEN=gpt-4.1-mini`, `AI_MODEL_EDIT=gpt-4.1-mini`, `AI_MODEL_FALLBACK=gpt-5.4-mini`.
- Add cost + latency metrics to Posthog / existing observability per model.

### Expected savings
~80-90% reduction in AI API spend vs current gpt-4o hardcode, with equal-or-better JSON reliability. Monthly spend at 1K/10K scale drops from ~$278 → ~$22 (all 4.1-mini) or ~$54 (5.4-mini site-gen + 4.1-mini edit). At 10× scale the savings are what pay for a content team.

## 9. Unresolved questions

1. **Creative variety A/B**: no public benchmark compares 4o vs 4.1-mini vs 5.4-mini on "generate 10 websites for restaurants, how similar are they". We need an internal eval (10 identical inputs, measure block-combo diversity + copy uniqueness).
2. **gpt-5.4-mini on deeply nested schemas**: community evidence it's better than gpt-5-mini but no hard data on our 10-15-block nested shape. Run 50-call pilot before flipping primary.
3. **gpt-4.1 API deprecation date**: OpenAI retired 4.1 from ChatGPT 2026-02-13 but API still live. No published API retirement date — confirm via OpenAI support/changelog before long-term commitment. If <6mo runway, prefer gpt-5.4-mini as primary despite cost.
4. **Strict mode + dynamic block schemas**: our block types are dynamic (plugin-style). json_schema strict requires fixed schema — may need `oneOf` union per block type or two-phase generation (outline → fill).
5. **Cache hit rate on system prompt**: our system prompt (block types + variants listing) is stable ~2K tokens. Cached input is 5-10× cheaper — if we keep system prompt identical across calls the cache should kick in automatically (OpenAI auto-caches >1024 tokens), but worth instrumenting.
6. **Vercel AI Gateway rate limits / cold-start**: verify gateway doesn't add latency vs direct OpenAI on p95. Docs say ~none but measure.
7. **Does our current `response_format: json_object` code path actually validate?** No — it only guarantees parseable JSON, not schema conformance. Any move to strict json_schema is a correctness win independent of model swap.

---

Sources:
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [OpenAI Developers — Pricing](https://developers.openai.com/api/docs/pricing)
- [PricePerToken — OpenAI](https://pricepertoken.com/pricing-page/provider/openai)
- [OpenAI Structured Outputs Guide](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Reasoning Models Guide](https://developers.openai.com/api/docs/guides/reasoning)
- [Using GPT-5.4](https://developers.openai.com/api/docs/guides/latest-model)
- [Introducing GPT-4.1](https://openai.com/index/gpt-4-1/)
- [Community: gpt-4.1-mini > gpt-5-mini for structured output](https://community.openai.com/t/gpt-4-1-mini-gpt-5-mini-for-image-analysis/1374016)
- [Community: gpt-4.1 structured output clarity](https://community.openai.com/t/clarity-on-gpt-4-1-and-o4-mini-structured-output-support/1230973)
- [Vercel AI Gateway docs](https://vercel.com/docs/ai-gateway)
- [Vercel AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing)
- [Artificial Analysis — gpt-5-mini vs gpt-4.1](https://artificialanalysis.ai/models/comparisons/gpt-5-mini-vs-gpt-4-1)
- [DataCamp — GPT-5.4 mini/nano benchmarks](https://www.datacamp.com/blog/gpt-5-4-mini-nano)
