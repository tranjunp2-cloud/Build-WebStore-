# SPEC: Daily Project Report — Prime Bot Assistant

> Bot tự động báo cáo tiến độ project hàng ngày vào nhóm Lark riêng (PM + Bot).
> Target repo: `prime-bot-assistant`

---

## 1. Tổng quan

| Item | Detail |
|------|--------|
| **Tính năng** | Daily Project Health Report |
| **Kênh gửi** | Lark group riêng PM + Bot (ID: cần tạo hoặc dùng `BOT Assistant - Tech Group`) |
| **Lịch chạy** | Mỗi ngày 9:00 AM MYT (UTC+8), thứ 2 → thứ 6 |
| **Trigger** | Cron schedule + manual command `/report` |
| **Data source** | GitHub API (issues, PRs, milestones, labels) |
| **Output** | Lark rich text message (markdown) |

---

## 2. Prompt cho Bot AI

Bot sẽ dùng prompt này để generate report từ raw GitHub data:

```
Bạn là PM Assistant cho project ECH Prime Web v2.
Dựa trên dữ liệu GitHub bên dưới, tạo báo cáo tiến độ hàng ngày bằng tiếng Việt.

FORMAT BÁO CÁO:

📊 DAILY REPORT — {ngày/tháng/năm}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TỔNG QUAN
• Tổng issues: {total} | Done: {closed} ({pct}%)
• Còn lại: {open} issues | Deadline gần nhất: {nearest_due}

📈 TIẾN ĐỘ THEO WAVE
{Bảng mỗi wave: tên | done/total | % | due date | status emoji}
- 🟢 ≥ 80% | 🟡 40-79% | 🔴 < 40% | ⚪ chưa bắt đầu

🔥 HOẠT ĐỘNG 24H QUA
• Issues closed: {count} — liệt kê top 5
• PRs merged: {count} — liệt kê
• PRs đang open: {count} — cần review

⚠️ CẢNH BÁO
• Issues quá hạn (milestone due đã qua): liệt kê
• Issues qa:pending > 3 ngày chưa test: liệt kê
• Issues qa:failed chưa fix: liệt kê
• Milestones có risk trễ deadline: đánh giá

👥 PHÂN BỔ CÔNG VIỆC
• Unassigned issues: {count} — ⚠️ nếu > 5
• Issues per dev: bảng {dev | assigned | in_progress | done tuần này}

🧪 QA PIPELINE
• Chờ test (qa:pending): {count}
• Đang test: {count}
• Failed cần fix (qa:failed): {count}
• Passed tuần này: {count}

📋 ĐỀ XUẤT HÔM NAY
Dựa trên data, đề xuất 3-5 actions cụ thể cho PM:
1. {action cụ thể + lý do + issue numbers}
2. ...

🏁 COUNTDOWN
• Release deadline: {date} — còn {N} ngày
• Velocity tuần này: {issues closed / ngày}
• Dự kiến hoàn thành: {estimated date nếu giữ velocity}
```

---

## 3. Data cần collect từ GitHub API

### 3.1 Milestones
```
GET /repos/{owner}/{repo}/milestones
→ title, open_issues, closed_issues, due_on, state
```

### 3.2 Issues (open + recently closed)
```
GET /repos/{owner}/{repo}/issues?state=all&since={24h_ago}&per_page=100
→ number, title, state, labels, assignees, milestone, created_at, closed_at, updated_at
```

### 3.3 Labels filter
```
qa:pending  → issues chờ QA test
qa:failed   → issues QA fail, cần dev fix
qa:passed   → issues QA passed
```

### 3.4 PRs (open + recently merged)
```
GET /repos/{owner}/{repo}/pulls?state=all&sort=updated&per_page=20
→ number, title, state, merged_at, user, requested_reviewers
```

### 3.5 Issue timeline (cho PR linking)
```
GET /repos/{owner}/{repo}/issues/{number}/timeline
→ find cross-referenced PRs
```

---

## 4. Logic xử lý

### 4.1 Tính % tiến độ
```javascript
for each milestone:
  total = open_issues + closed_issues
  pct = total > 0 ? (closed_issues / total * 100) : 0
  status = pct >= 80 ? '🟢' : pct >= 40 ? '🟡' : pct > 0 ? '🔴' : '⚪'
  days_left = diffDays(due_on, today)
  at_risk = days_left <= 7 && pct < 70
```

### 4.2 Cảnh báo tự động
```javascript
// Issues quá hạn
overdue = issues.filter(i => i.milestone?.due_on < today && i.state === 'open')

// QA pending quá lâu
stale_qa = issues.filter(i =>
  hasLabel(i, 'qa:pending') &&
  daysSince(labelAddedDate(i, 'qa:pending')) > 3
)

// QA failed chưa fix
qa_failed = issues.filter(i => hasLabel(i, 'qa:failed') && i.state === 'open')

// Velocity
closed_this_week = issues.filter(i => i.closed_at > startOfWeek)
velocity = closed_this_week.length / daysSinceMonday
estimated_days_remaining = open_issues / velocity
```

### 4.3 Risk scoring
```
HIGH RISK (🔴):
- Milestone due trong 7 ngày + < 70% done
- qa:failed > 3 issues
- 0 PRs merged trong 2 ngày

MEDIUM RISK (🟡):
- Milestone due trong 14 ngày + < 50% done
- qa:pending > 10 issues
- Unassigned > 10 issues

LOW RISK (🟢):
- On track (velocity đủ để hoàn thành trước deadline)
```

---

## 5. Lark Message Format

### Rich text message (post type)
```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "vi": {
        "title": "📊 Daily Report — 25/03/2026",
        "content": [
          [{"tag": "text", "text": "🎯 TỔNG QUAN\n"}],
          [{"tag": "text", "text": "• Tổng: 117 issues | Done: 32 (27%)\n"}],
          [{"tag": "text", "text": "• Release: 31/03 — còn 6 ngày\n"}],
          [{"tag": "text", "text": "\n📈 TIẾN ĐỘ\n"}],
          [{"tag": "text", "text": "🟢 Wave 1: CMS — 83% (25/30)\n"}],
          [{"tag": "text", "text": "🟡 Wave 5: Orders — 40% (4/10)\n"}],
          [{"tag": "text", "text": "🔴 Wave 3: Editor — 26% (11/41)\n"}],
          [{"tag": "text", "text": "\n⚠️ CẢNH BÁO\n"}],
          [{"tag": "text", "text": "• 23 issues chờ QA > 3 ngày\n"}],
          [{"tag": "text", "text": "• 0 issues assigned\n"}],
          [{"tag": "text", "text": "\n📋 ĐỀ XUẤT\n"}],
          [{"tag": "text", "text": "1. Assign dev cho F18 CMS Layout (#131-#133)\n"}],
          [{"tag": "text", "text": "2. QC test F01 AI Builder (8 issues pending)\n"}],
          [{"tag": "a", "text": "📋 View Board", "href": "https://github.com/orgs/primeproduction/projects/8"}]
        ]
      }
    }
  }
}
```

### Interactive card (nâng cao — phase 2)
```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": {"tag": "plain_text", "content": "📊 Daily Report — 25/03"},
      "template": "blue"
    },
    "elements": [
      {"tag": "markdown", "content": "**🎯 Tổng: 32/117 (27%)** | Release: 31/03 (6 ngày)"},
      {"tag": "column_set", "columns": [...]},
      {"tag": "action", "actions": [
        {"tag": "button", "text": {"content": "📋 Board"}, "url": "...", "type": "primary"},
        {"tag": "button", "text": {"content": "🧪 QA Queue"}, "url": "..."}
      ]}
    ]
  }
}
```

---

## 6. API Endpoint cho Bot

### POST /api/reports/daily
```typescript
// Trigger: Cron 9:00 AM MYT hoặc manual
// Steps:
// 1. Fetch GitHub data (milestones + issues + PRs)
// 2. Calculate metrics
// 3. Generate report via AI prompt
// 4. Send to Lark group

interface DailyReportConfig {
  github: {
    owner: 'primeproduction';
    repo: 'ech-prime-web-v2';
    projectNumber: 8;
  };
  lark: {
    groupChatId: string; // Nhóm PM + Bot
  };
  schedule: {
    cron: '0 1 * * 1-5'; // 9:00 MYT = 1:00 UTC
    timezone: 'Asia/Kuala_Lumpur';
  };
}
```

### GET /api/reports/daily?format=json
```typescript
// Return raw data (cho dashboard hoặc debug)
interface DailyReport {
  date: string;
  milestones: MilestoneStatus[];
  activity24h: { issuesClosed: number; prsMerged: number; };
  qaStatus: { pending: number; failed: number; passed: number; };
  warnings: Warning[];
  recommendations: string[];
  velocity: { perDay: number; estimatedCompletion: string; };
}
```

---

## 7. Env vars cần thêm cho Bot

```env
# GitHub (đã có)
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=primeproduction
GITHUB_REPO=ech-prime-web-v2
GITHUB_PROJECT_NUMBER=8

# Lark group cho daily report
LARK_PM_GROUP_CHAT_ID=oc_xxx  # Nhóm riêng PM + Bot

# Schedule
DAILY_REPORT_ENABLED=true
DAILY_REPORT_CRON=0 1 * * 1-5
```

---

## 8. Manual trigger

PM có thể gọi report bất kỳ lúc nào:

```
@PrimeBot /report           → Full daily report
@PrimeBot /report wave1     → Report chỉ Wave 1
@PrimeBot /report qa        → Report QA pipeline
@PrimeBot /report risks     → Chỉ cảnh báo + đề xuất
```

---

## 9. Implementation phases

### Phase 1 (MVP — tuần này)
- [ ] Endpoint `/api/reports/daily` — collect GitHub data + format text
- [ ] Gửi Lark post message (plain text, không card)
- [ ] Cron schedule 9:00 AM MYT weekdays
- [ ] Manual trigger `/report`

### Phase 2 (tuần sau)
- [ ] Lark interactive card (buttons, columns)
- [ ] AI-generated recommendations (dùng prompt ở §2)
- [ ] Filter commands: `/report wave1`, `/report qa`
- [ ] Historical data (lưu daily snapshots để so sánh trend)

### Phase 3 (tháng sau)
- [ ] Weekly summary (so sánh tuần này vs tuần trước)
- [ ] Sprint retrospective auto-report
- [ ] Alert khi velocity giảm > 30%
- [ ] Dashboard web (chart tiến độ over time)
