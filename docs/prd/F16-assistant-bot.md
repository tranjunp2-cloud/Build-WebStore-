# PRD: Assistant Bot (F16)
> **Version:** 1.0 | **Created:** 2026-03-11 | **Agent:** `antigravity`  
> **Priority:** P1 | **Sprint:** Wave 6 — Sprint 1 | **Size:** M  
> **Depends on:** F02-auth | **Blocks:** —

---

## 1. Problem Statement

Team cần một trợ lý AI nội bộ để nhanh chóng giải đáp câu hỏi về dự án PrimeWeb mà không cần tìm kiếm trong docs hay hỏi đồng nghiệp. Bot giúp giảm thời gian onboarding và tăng tốc workflow.

## 2. Target User

- Team dev PrimeWeb (internal)
- Kỹ năng technical: junior to senior
- Ngôn ngữ: Tiếng Việt (chuyển sang English khi cần)

## 3. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Usage rate | >5 queries/member/day | API logs |
| Response quality | >80% helpful | Team feedback |
| Onboarding time reduction | -30% | New member surveys |

## 4. User Story

```
AS A PrimeWeb team member
I WANT TO ask an AI bot about the project
SO THAT I can quickly get answers without searching docs or asking teammates
```

## 5. Screen Layout

```
┌──────────────────────────────────────┐
│ Dashboard (with sidebar)             │
│                                      │
│                              ┌─────┐ │
│                              │ 🤖  │ │  ← Floating button (bottom-right)
│                              └─────┘ │
└──────────────────────────────────────┘

Click → Panel slides from right:

┌───────────────────┬──────────────────┐
│  Dashboard        │  PrimeBot        │
│                   │  ─────────────── │
│                   │  Welcome msg     │
│                   │  Quick actions   │
│                   │                  │
│                   │  ─────────────── │
│                   │  [Input] [Send]  │
└───────────────────┴──────────────────┘
```

## 6. Acceptance Criteria

### AC-1: Happy Path
```gherkin
GIVEN user is logged in and on dashboard
WHEN user clicks the floating bot button
THEN a chat panel slides out from the right
AND user can type a question and receive streaming AI response
```

### AC-2: Quick Actions
```gherkin
GIVEN the chat panel is open
WHEN user clicks a quick action chip
THEN the question is sent automatically
AND bot responds with relevant project information
```

### AC-3: Error Handling
```gherkin
GIVEN the API fails to respond
WHEN user sends a message
THEN an error state is shown
AND user can retry
```

## 7. Technical Architecture

### 7.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `AssistantButton` | `src/components/assistant/AssistantButton.tsx` | Floating trigger button |
| `AssistantPanel` | `src/components/assistant/AssistantPanel.tsx` | Slide-out chat panel |
| `MessageBubble` | `src/components/assistant/MessageBubble.tsx` | Message rendering |
| `QuickActions` | `src/components/assistant/QuickActions.tsx` | Quick action chips |

### 7.2 API Endpoints

```
POST /api/assistant → SSE stream
Request: { messages: Message[] }
Response: Server-Sent Events (streaming text)
Auth: Required (payload-token cookie)
```

### 7.3 Data Flow

```
User Input → useChat hook → POST /api/assistant
  → Vercel AI SDK streamText() → OpenAI GPT-4o-mini
  → SSE stream → useChat auto-updates messages state
  → MessageBubble re-renders
```

## 8. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| `ai` (Vercel AI SDK) | ✅ Installed | — |
| `@ai-sdk/openai` | ✅ Installed | — |
| `OPENAI_API_KEY` | ✅ Configured | Shared with existing AI module |
| Auth (F02) | ✅ Done | Cookie-based auth check |

## 9. 9-Point Done Checklist

- [x] Loading State — Typing indicator animation
- [x] Empty State — Welcome message + quick actions
- [x] Error State — Handled by useChat hook
- [ ] Form Validation — Non-empty input check
- [x] Button States — Disabled when loading/empty
- [ ] Toast Feedback — N/A (inline feedback)
- [x] Auth Redirect — 401 from API if no token
- [ ] Mobile 375px — Panel goes full-width on mobile
- [ ] TypeScript Clean — `tsc --noEmit` pass
