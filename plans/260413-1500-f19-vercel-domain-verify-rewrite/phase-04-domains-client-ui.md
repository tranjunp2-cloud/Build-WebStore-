# Phase 04 — Update DomainsClient UI

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase 03 (new return shape)
- Vercel docs: https://vercel.com/docs/domains/working-with-dns

## Overview
- Date: 2026-04-13
- Description: Update `DomainsClient.tsx` to render TXT challenge instructions when verify returns `verification[]`, swap DNS constants to Vercel-driven envs, refresh copy.
- Priority: P0 (UX completion of bug fix)
- Implementation status: pending
- Review status: pending

## Key insights
- Today the UI assumes a single A-record instruction (`SERVER_IP`). Vercel may require BOTH an A/CNAME for routing AND a TXT for ownership proof — UI must show both when applicable.
- TXT challenges are tenant-actionable: render `verification.domain` + `verification.value` in copyable code blocks.
- DNS constants must move to client-safe `NEXT_PUBLIC_VERCEL_APEX_IP` / `NEXT_PUBLIC_VERCEL_CNAME_TARGET` envs with hardcoded fallbacks identical to phase 03.

## Requirements
- New collapsible "Verify ownership" panel that appears when action returns `verification`.
- Existing DNS instructions panel still shows A/CNAME setup (rewritten to Vercel values).
- All copy reviewed for "DigitalOcean"/"DO"/"server IP" → replace with neutral "Vercel"/"DNS target" language.
- Toast messages updated for new states.
- Client-side debounce on Verify button (prevents double-click → rate limit).

## Architecture
```
DomainsClient.tsx
├── DNS_A_RECORD = process.env.NEXT_PUBLIC_VERCEL_APEX_IP ?? '76.76.21.21'
├── DNS_CNAME    = process.env.NEXT_PUBLIC_VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com'
├── <DnsInstructionsCard />        — A record + CNAME setup (always visible for pending)
└── <TxtChallengeCard verification={...} />  — NEW: shown only when state.verification?.length
```

`TxtChallengeCard` props: `verification: { type, domain, value, reason }[]`. Renders one copyable row per challenge with reason as caption.

## Related code files
- Modify: `src/app/(dashboard)/settings/domains/DomainsClient.tsx`
  - L9–10: replace `NEXT_PUBLIC_SERVER_IP` / `NEXT_PUBLIC_CNAME_TARGET` with new envs
  - L213–280: action call sites — handle new `verification` field in returned state
  - Add new `TxtChallengeCard` (can be inline component or `./TxtChallengeCard.tsx`)
  - L221, L237, L255, L278: update toast copy
- Modify: `src/__tests__/unit/dashboard/f19-domains-client.test.tsx` — covered by phase 05

## Implementation steps
1. Swap L9–10 env vars to `NEXT_PUBLIC_VERCEL_APEX_IP` and `NEXT_PUBLIC_VERCEL_CNAME_TARGET` with literal fallbacks.
2. Extend local React state to hold per-domain `verification` array (e.g. `Map<domain, VercelDomainVerification[]>`).
3. After `addCustomDomain` and `verifyCustomDomain` calls, if response includes `verification`, store it; if `ok: true`, clear it.
4. Render `<TxtChallengeCard>` conditionally below the DNS instructions for any pending domain that has a `verification` entry.
5. Add `useTransition` or `isPending` lock around Verify button to prevent double-clicks.
6. Update toast copy: success ("Domain active. SSL provisioning may take 1–2 minutes."), pending-with-txt ("Add the TXT record below, then click Verify."), error ("Verification failed: {reason}").
7. Manual visual check on `/settings/domains` (storybook or local dev).

## Todo
- [ ] Replace L9–10 env vars + add literal fallbacks
- [ ] State: track verification challenges per pending domain
- [ ] Inline `TxtChallengeCard` component with copyable rows
- [ ] Wire into `addCustomDomain` and `verifyCustomDomain` callbacks
- [ ] Verify button debounce (`useTransition`)
- [ ] Update all 4 toast strings
- [ ] Visual smoke test on local dev

## Success criteria
- When verify action returns `verification`, UI shows the TXT record name + value with copy buttons.
- When verify returns `ok: true`, TXT card disappears + status badge flips to "Active".
- DNS instructions show `76.76.21.21` and `cname.vercel-dns.com` by default.
- Verify button cannot be triggered twice within 1 second.

## Risk assessment
- Low. Pure UI extension. Fallback rendering covers missing verification gracefully (panel just doesn't show).
- Edge: very long `verification.value` strings (TXT challenges are ~40 chars typical) — use `break-all` Tailwind class.

## Security considerations
- TXT challenge values are public DNS data — safe to render. No XSS risk if rendered as text content.
- Do NOT render raw error messages from server actions — they may include API URL fragments. Map to friendly strings client-side.

## Next steps
- Phase 05 updates the matching test file.

## Open questions
- Should the TXT card auto-poll Vercel verify every 30s, or wait for explicit user click? Recommend: explicit click (respects rate limit, better UX clarity). Add a "Last checked: 2 min ago" timestamp instead.
