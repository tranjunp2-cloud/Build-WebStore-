---
date: 2026-04-17
branch: fix/F05-ai-editor-improvements
tags: [f05, ai-editor, chat, flow-diagram, reference]
purpose: quick-reference flow AI chat editor F05 — đọc trước khi sửa src/app/api/ai/edit-block/ hoặc src/components/editor/AIChatPanel.tsx
---

# F05 — AI Chat Editor Flow

> **Đọc file này khi:** cần hiểu user gõ prompt → website thay đổi thế nào, data đi đâu, action nào tồn tại.
> **Related:** `docs/journals/260414-ai-gen-flow-overview.md` (flow gen site ban đầu — khác với flow edit này)

---

## 1. Tổng quan — 1 prompt = 1 action

```
User gõ instruction vào AIChatPanel
          │
          ▼
POST /api/ai/edit-block?stream=true
(kèm selected block + all blocks + theme + last 10 messages)
          │
          ▼
Backend build system prompt → OpenAI chat.completions (JSON mode)
          │
          ▼
AI trả JSON { action, ...payload, message }
          │
          ▼
Backend validate / sanitize → SSE stream xuống client
          │
          ▼
AIChatPanel.onAIAction(action) → page.tsx handleAIAction switch
          │
          ▼
Zustand store mutate (updateBlock / updateTheme / addBlock / ...)
          │
          ▼
setTimeout 300ms → handleSave() → PATCH /api/sites/[siteId]/save
```

---

## 2. Các thành phần chính

| Tầng | File | Vai trò |
|---|---|---|
| UI | `src/components/editor/AIChatPanel.tsx` | Input, message list, SSE reader, gọi `onAIAction` |
| Transport | `src/app/api/ai/edit-block/route.ts` | Build prompt, call OpenAI, validate response, stream SSE |
| Action dispatcher | `src/app/(editor)/editor/[siteId]/page.tsx` (`handleAIAction`) | Switch action → Zustand mutation |
| State | `useEditorStore` (Zustand) | `blocks`, `theme`, `history`, `pushBatch`, `undo/redo` |
| Persistence | `src/app/api/sites/[siteId]/save/route.ts` | PATCH site + page layout, theme sanitize |
| Types | `src/types/editor.ts` | `AIAction` union (source of truth cho frontend) |
| Shared helpers | `src/lib/ai/summarize.ts`, `src/lib/theme/enums.ts` | Extract từ route.ts để test + dùng chung với save route |

---

## 3. Action types (đồng bộ giữa BE & FE)

| Action | Payload chính | Handler |
|---|---|---|
| `update_block` | `blockIndex`, `changes` | `updateBlock(idx, changes)` |
| `update_multiple_blocks` | `updates: [{blockIndex, changes}, ...]` | `pushBatch(newBlocks, ...)` — 1 history entry cho N blocks |
| `update_theme` | `changes` | `updateTheme(changes)` |
| `add_block` | `afterIndex`, `block` | `normalizeAddSectionBlock()` + `addBlock(afterIndex, block)` |
| `delete_block` | `blockIndex` | `deleteBlock(idx)` + adjust selection |
| `undo` | — | `undo()` từ history stack |
| `none` | `message` (out-of-scope / filter empty) | Render message, không mutate |

---

## 4. Backend prompt — cấu trúc system message

```
## CONTEXT          — siteName, page title/slug, theme, N blocks
## SELECTED BLOCK   — JSON.stringify(block, null, 2).slice(0, 3000)   ← chỉ khi có selected
## CURRENT PAGE     — compact summary: top-level text fields + nested array/object summaries
## AVAILABLE TYPES  — blockRegistry.getAllMeta() → type + variants
## TASK             — return JSON action
## RESPONSE FORMAT  — 7 shapes (mỗi action 1 block code)
## RULES            — 10 rules (include COMPLETE arrays, blockIndex từ list, ...)
## NESTED FIELD     — examples + common schemas (ctaButtons, faqs, links, ...)
## SCOPE            — reject unrelated requests → action: "none"
```

**Nguồn duy nhất cho theme enum:** `src/lib/theme/enums.ts` → `buildEnumPrompt()`. Same file export `buildEnumSets()` cho save sanitizer. Thêm font/preset mới → sửa 1 chỗ.

**Block summary:** `summarizeNestedField()` in `src/lib/ai/summarize.ts` — cap 5 items/array, truncate 60-80 chars/string. Đảm bảo prompt không bung token khi page có block lớn.

---

## 5. Guard rails — từ request đến response

| Layer | Guard | File |
|---|---|---|
| Auth | `withAuth(user, req)` — requires session | `edit-block/route.ts` |
| Rate limit | 20 AI tasks/hour per user | `edit-block/route.ts` |
| Input schema | Zod `editBlockSchema` | `src/lib/validations/ai.ts` |
| Model config | `selectModel('chat-edit')` — temp 0.3 fidelity | `src/lib/ai/config.ts` |
| Output validation | filter `update_multiple_blocks.updates` (blockIndex ≥ 0, ≤ maxIndex, typeof number) | `edit-block/route.ts:328` |
| Empty-after-filter | downgrade `action = 'none'` với message cảnh báo | `edit-block/route.ts:340` |
| Add block validation | `blockRegistry.validate()` — fallback `createAddSectionBlock()` nếu fail | `edit-block/route.ts:380` |
| Save sanitize | `ALLOWED_THEME_KEYS` + `SELECT_FIELD_VALUES` (từ `THEME_ENUMS`) | `sites/[siteId]/save/route.ts` |
| XSS client | `DOMPurify.sanitize` assistant messages | `AIChatPanel.tsx:14` |
| Save rate limit | 60/min per user (cho phép autosave 1s) | `sites/[siteId]/save/route.ts` |

---

## 6. Session context — chat history

- FE gửi last 10 messages (filter streaming) lên backend
- Mỗi message cap 300 chars
- Backend inject giữa system prompt và current user instruction
- Cho phép conversational editing: "đổi màu xanh hơn" sau "đổi thành cam" → hiểu ngữ cảnh

Persistence: `sessionStorage['editor-chat-<siteId>']` — mất khi đóng tab (cố ý, không pollute với old conversations).

---

## 7. Recent improvements (F05 AI editor — Apr 2026)

Plan dirs liên quan:
- `plans/260416-1514-fix-ai-editor-nested-fields/` — nested array editing (ctaButtons, faqs truncation fix)
- `plans/260416-1600-fix-ai-multi-block-edit/` — `update_multiple_blocks` action cho translate cả trang
- `plans/260416-1802-fix-review-cleanup/` — code review cleanup pass 1
- `plans/260417-0956-fix-review-issues/` — 5 review issues (C1/C2/I1/I2/I3)

Commit PR #689: `fix(f05): ai editor nested fields, multi-block edit, review fixes` (commit `b8cb3891`).

Test coverage mới thêm:
- `TC-F01-NESTED-01..12` — `summarizeNestedField()` 12 cases
- `TC-F01-MULTI-01, 02` — multi-block happy path + out-of-bounds filter
- `TC-F01-COLOR-RESET-01..09` — mode-switch color reset (case-insensitive)
- `TC-F01-THEME-VAL-01..06` — save route theme enum sanitize
- `TC-F01-FAQ-DUAL-01..05` — FAQ dual-field fallback (C2 guard)
- `TC-F01-CONTACT-KEYS-01..02` — React key uniqueness trong form map

---

## 8. Edge cases cần biết

1. **No OPENAI_API_KEY** → backend trả `add_block` từ `createAddSectionBlock()` nếu instruction match `isAddSectionInstruction()`; else trả `update_block` với message "requires key". Không crash.
2. **AI trả out-of-scope** (e.g., "write a poem") → action `none`, FE render message, không apply.
3. **AI trả blockIndex = 99 trên trang 2 block** → backend filter hết → action downgrade `none` → UI hiện "no valid block updates".
4. **AI trả mới blockType không có trong registry** → backend throw `Unknown block type` → SSE error → FE show error toast.
5. **Auto-save race** — `handleAIAction` đầu tiên clear `autoSaveTimer` pending để tránh stale save ghi đè AI mutation.
6. **Undo sau AI edit** → push vào history stack qua `updateBlock/pushBatch`; `undo()` revert + save để persist revert state.

---

## 9. Non-goals / known limitations

- Không support multi-turn tool calling (mỗi prompt = 1 response = 1 action).
- Không streaming content updates — chỉ stream status events rồi 1 shot final action.
- blockIndex filter chưa reject float (`0.5` passes). Follow-up khi cần.
- Theme reset case-insensitive chỉ so sánh với opposite-mode default (không detect "custom but visually identical").

---

## 10. Nếu thêm action mới (checklist)

1. Thêm vào `AIAction` union trong `src/types/editor.ts`
2. Thêm vào `AIEditResult.action` trong `edit-block/route.ts`
3. Thêm case trong `describeAction()` cho default message
4. Thêm case vào `handleAIAction` switch trong `page.tsx`
5. Update system prompt block trong route.ts với response shape mới
6. Add TC-F01-xxx test trong `src/__tests__/api/ai.test.ts`
7. Verify undo/redo compat nếu action thay đổi blocks/theme
