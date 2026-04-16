# User Flow: Luồng tạo Website lần đầu (F01)

> **Phiên bản:** 2.0  
> **Ngày cập nhật:** 2026-04-14  
> **Trạng thái:** Draft — Đang review  
> **Liên quan:** F01 (Builder), F06 (Onboarding), F05 (Editor)

---

## 1. Tổng quan

Tài liệu mô tả **toàn bộ luồng** từ lúc user đăng nhập đến khi có website hoàn chỉnh.

### Nguyên tắc UX

> [!IMPORTANT]
> 1. **Không bao giờ để user dead-end** — Mọi màn hình đều có "next action"
> 2. **AI chỉ là 1 option, không phải duy nhất** — Luôn có fallback = Template CMS
> 3. **AI fail → user vẫn hoàn thành website** bằng CMS template (không bị kẹt)
> 4. **Luôn có đường đi tiếp** — Dù bất kỳ lỗi nào xảy ra

---

## 2. Master Flow — Toàn bộ luồng

```mermaid
flowchart TD
    START(["👤 User đăng nhập"]) --> OTP["Xác thực OTP"]
    OTP --> WELCOME["📋 Welcome Screen"]
    
    WELCOME --> CHOICE{"User chọn"}
    CHOICE -->|"🤖 Tạo web bằng AI"| BUILDER
    CHOICE -->|"⏭️ Vào thẳng Dashboard"| DASH_CHECK
    
    %% ══════════════════════════════════
    %% NHÁNH 1: VÀO DASHBOARD
    %% ══════════════════════════════════
    DASH_CHECK{"Dashboard kiểm tra"}
    DASH_CHECK -->|"Chưa có website"| DASH_EMPTY
    DASH_CHECK -->|"Đã có website"| DASH_SITES
    
    subgraph DASH_EMPTY["Dashboard — Chưa có website"]
        DE_CTA1["🤖 CTA: Build website with AI"]
        DE_CTA2["📄 CTA: Choose template (optional)"]
    end
    
    subgraph DASH_SITES["Dashboard — Đã có website"]
        DS_LIST["🌐 Site list + trạng thái<br/>(draft / published)"]
    end
    
    DE_CTA1 -->|"Bấm"| BUILDER
    DE_CTA2 -->|"Bấm"| TEMPLATE["📄 Template Library"]
    
    %% ══════════════════════════════════
    %% NHÁNH 2: BUILD WITH AI
    %% ══════════════════════════════════
    subgraph BUILDER["🤖 AI Builder /builder/new"]
        direction TB
        B_FORM["Step 1: Form nhập thông tin<br/>Tên, ngành, mô tả, sản phẩm"]
        B_GEN["Step 2: AI đang tạo...<br/>Progress bar + streaming"]
        B_PREVIEW["Step 3: Preview kết quả"]
        
        B_FORM -->|"Submit"| B_GEN
        B_GEN -->|"✅ Thành công"| B_PREVIEW
        B_GEN -->|"❌ Lỗi"| B_ERROR["Redirect → Dashboard"]
    end
    
    %% ══════════════════════════════════
    %% SAU KHI THÀNH CÔNG
    %% ══════════════════════════════════
    B_PREVIEW --> SUCCESS_CHOICE{"User chọn"}
    SUCCESS_CHOICE -->|"✏️ Edit"| EDITOR["Editor /editor/siteId"]
    SUCCESS_CHOICE -->|"🏠 Về Dashboard"| DASH_SITES
    
    %% ══════════════════════════════════
    %% SAU KHI LỖI → DASHBOARD XỬ LÝ
    %% ══════════════════════════════════
    B_ERROR --> DASH_FAIL
    
    subgraph DASH_FAIL["Dashboard — Sau khi AI fail"]
        DF_DETECT["System detect trạng thái site"]
        DF_DETECT --> DF_CHECK{"Site đã tạo<br/>trong DB chưa?"}
        
        DF_CHECK -->|"Chưa tạo được<br/>(lỗi sớm)"| DF_NO_SITE["Hiện CTA tạo mới<br/>như Dashboard trống"]
        DF_CHECK -->|"Đã tạo nhưng incomplete<br/>(cần check thêm)"| DF_HAS_DRAFT
        
        subgraph DF_HAS_DRAFT["Site draft incomplete"]
            DH_BANNER["⚠️ Banner:<br/>'Website tạo bằng AI chưa hoàn tất'"]
            DH_CTA1["🔄 CTA: Retry AI (optional)"]
            DH_CTA2["📄 CTA: Chọn template từ thư viện CMS"]
        end
    end
    
    DF_NO_SITE -->|"Build with AI"| BUILDER
    DF_NO_SITE -->|"Choose template"| TEMPLATE
    DH_CTA1 -->|"Bấm"| BUILDER
    DH_CTA2 -->|"Bấm"| TEMPLATE
    
    %% ══════════════════════════════════
    %% FALLBACK: TEMPLATE CMS
    %% ══════════════════════════════════
    TEMPLATE --> EDITOR

    %% Styles
    style START fill:#DBEAFE,stroke:#3B82F6,color:#1E3A5F
    style WELCOME fill:#F0FDF4,stroke:#22C55E
    style BUILDER fill:#EEF2FF,stroke:#6366F1
    style DASH_EMPTY fill:#EFF6FF,stroke:#3B82F6
    style DASH_SITES fill:#ECFDF5,stroke:#10B981
    style DASH_FAIL fill:#FFF7ED,stroke:#F97316
    style DF_HAS_DRAFT fill:#FEF3C7,stroke:#F59E0B
    style B_ERROR fill:#FEE2E2,stroke:#EF4444
    style TEMPLATE fill:#F5F3FF,stroke:#8B5CF6
```

---

## 3. Luồng chi tiết từng bước

### 3.1 Sau Login + OTP → Welcome Screen

```mermaid
sequenceDiagram
    actor User
    participant Auth as Login + OTP
    participant MW as Middleware
    participant Welcome as Welcome Screen
    participant Builder as /builder/new
    participant Dashboard as /dashboard

    User->>Auth: Đăng nhập + nhập OTP
    Auth->>MW: Token verified + MFA verified
    MW->>Welcome: Render Welcome Screen
    
    Note over Welcome: Hiện 2 lựa chọn rõ ràng

    alt 🤖 User chọn "Tạo web bằng AI"
        User->>Welcome: Bấm "Build with AI"
        Welcome->>Builder: Navigate → /builder/new
    end

    alt ⏭️ User chọn "Vào thẳng Dashboard"
        User->>Welcome: Bấm "Skip / Go to Dashboard"
        Welcome->>Dashboard: Navigate → /dashboard
    end
```

### 3.2 Dashboard — Phân nhánh theo trạng thái

```mermaid
flowchart TD
    DASH["📊 Dashboard"] --> CHECK{"Kiểm tra trạng thái"}
    
    CHECK -->|"Không có site nào"| STATE_A
    CHECK -->|"Có site, AI tạo chưa hoàn tất"| STATE_B
    CHECK -->|"Có site draft (hoàn chỉnh)"| STATE_C
    CHECK -->|"Có site published"| STATE_D
    
    subgraph STATE_A["State A: Chưa có website"]
        A1["🤖 CTA chính: Build website with AI"]
        A2["📄 CTA phụ: Choose template (optional)"]
    end
    
    subgraph STATE_B["State B: AI tạo chưa hoàn tất"]
        B0["⚠️ Banner: 'Website tạo bằng AI chưa hoàn tất'"]
        B1["🔄 CTA: Retry AI (optional)"]
        B2["📄 CTA: Chọn template từ thư viện CMS"]
    end
    
    subgraph STATE_C["State C: Draft hoàn chỉnh"]
        C1["🌐 Site list — status: draft"]
        C2["✏️ Edit / 👁️ Preview"]
        C3["🚀 CTA: Publish"]
    end
    
    subgraph STATE_D["State D: Đã publish"]
        D1["🌐 Site list — status: published"]
        D2["📊 Analytics + SEO"]
    end

    style STATE_A fill:#EFF6FF,stroke:#3B82F6
    style STATE_B fill:#FEF3C7,stroke:#F59E0B
    style STATE_C fill:#FFF7ED,stroke:#F97316
    style STATE_D fill:#ECFDF5,stroke:#10B981
```

### 3.3 AI Builder — Generate Flow

```mermaid
stateDiagram-v2
    [*] --> Form: User vào /builder/new
    
    Form: 📝 Form nhập thông tin
    Form: - Tên doanh nghiệp
    Form: - Ngành nghề
    Form: - Mô tả ngắn
    Form: - Sản phẩm/dịch vụ
    Form: - Ngôn ngữ
    
    Generating: ⚙️ AI đang tạo website...
    Generating: - SSE stream từ API
    Generating: - Progress bar animation
    Generating: - Elapsed timer
    
    Preview: ✅ Preview kết quả
    Preview: - Live preview blocks
    Preview: - Site name + stats
    Preview: - Edit button
    Preview: - Go to Dashboard
    
    Form --> Generating: Submit
    Generating --> Preview: ✅ Thành công
    Generating --> RedirectDashboard: ❌ Lỗi
    
    Preview --> Editor: User bấm Edit
    Preview --> Dashboard: User bấm Dashboard
    
    RedirectDashboard --> [*]: 🏠 Về Dashboard
    Editor --> [*]
    Dashboard --> [*]

    note right of RedirectDashboard
        KHÔNG để user kẹt trong builder.
        Luôn redirect về dashboard.
    end note
```

---

## 4. Error Flow — Xử lý khi AI Generate lỗi

### 4.1 Phân loại lỗi theo thời điểm

```mermaid
flowchart TD
    subgraph TIMELINE["⏱️ Timeline quá trình tạo site (Server)"]
        direction LR
        T1["1. Validate"] --> T2["2. Auth"]
        T2 --> T3["3. AI Call"]
        T3 --> T4["4. Tạo Site<br/>trong DB"]
        T4 --> T5["5. Tạo Pages"]
        T5 --> T6["6. SSE Response<br/>→ Client"]
    end

    T1 -.->|"❌"| CASE_A
    T2 -.->|"❌"| CASE_A
    T3 -.->|"❌"| CASE_A
    
    T4 -.->|"❌"| CASE_B
    T5 -.->|"❌"| CASE_B
    T6 -.->|"❌"| CASE_B

    CASE_A["Case 1: Lỗi sớm<br/>Site CHƯA tạo trong DB"]
    CASE_B["Case 2: Lỗi giữa/cuối<br/>Site ĐÃ tạo trong DB<br/>(incomplete)"]
    
    CASE_A --> DASH_A["Dashboard: Không có site<br/>→ Hiện CTA tạo mới"]
    CASE_B --> DASH_B["Dashboard: Có site draft<br/>→ Cần check thêm đủ điều kiện chưa"]

    style CASE_A fill:#FEF3C7,stroke:#F59E0B
    style CASE_B fill:#FEE2E2,stroke:#EF4444
    style DASH_A fill:#EFF6FF,stroke:#3B82F6
    style DASH_B fill:#FFF7ED,stroke:#F97316
```

### 4.2 Dashboard sau khi AI fail

```mermaid
flowchart TD
    AI_FAIL["❌ AI Generate lỗi<br/>Builder redirect → Dashboard"] --> DETECT["System detect trạng thái"]
    
    DETECT --> HAS_SITE{"Có site trong DB?"}
    
    HAS_SITE -->|"KHÔNG<br/>(lỗi sớm, chưa tạo DB)"| NO_SITE
    HAS_SITE -->|"CÓ nhưng incomplete"| HAS_DRAFT
    
    subgraph NO_SITE["Dashboard trống"]
        NS1["Hiện như State A<br/>(chưa có website)"]
        NS2["🤖 CTA: Build with AI"]
        NS3["📄 CTA: Choose template"]
    end
    
    subgraph HAS_DRAFT["Dashboard có site incomplete"]
        HD0["⚠️ Banner: 'Website tạo bằng AI chưa hoàn tất'"]
        HD_NOTE["📋 Cần check: lỗi có đủ điều kiện tạo web chưa?<br/>Hiện tại gom chung về 1 case:<br/>'AI không thành công → điều hướng chọn template'"]
        HD1["🔄 Retry AI (optional)"]
        HD2["📄 Chọn template từ thư viện CMS"]
    end
    
    subgraph OPTIMIZE["🔍 Optimize (cần xác nhận)"]
        OP1["Nếu site tạo thành công nhưng lỗi<br/>(case chưa xác định rõ)"]
        OP2["Dashboard show draft"]
        OP3["UI hiển thị Banner cảnh báo"]
    end
    
    HAS_DRAFT -.->|"Cần check thêm"| OPTIMIZE
    
    NS2 --> BUILDER["→ /builder/new"]
    NS3 --> TEMPLATE["→ Template Library"]
    HD1 --> BUILDER
    HD2 --> TEMPLATE
    
    TEMPLATE --> EDITOR["→ Editor"]

    style AI_FAIL fill:#FEE2E2,stroke:#EF4444
    style NO_SITE fill:#EFF6FF,stroke:#3B82F6
    style HAS_DRAFT fill:#FEF3C7,stroke:#F59E0B
    style OPTIMIZE fill:#FFF7ED,stroke:#F97316,stroke-dasharray: 5 5
```

---

## 5. Fallback Flow — AI fail → Template CMS

> [!IMPORTANT]
> **Nguyên tắc:** AI fail → user vẫn hoàn thành website bằng CMS template (không bị kẹt)

```mermaid
flowchart LR
    A["🤖 Builder lỗi"] --> B["🏠 Dashboard"]
    B --> C["📄 Chọn template CMS"]
    C --> D["✏️ Editor"]
    D --> E["🚀 Publish"]
    
    style A fill:#FEE2E2,stroke:#EF4444
    style B fill:#FFF7ED,stroke:#F97316
    style C fill:#F5F3FF,stroke:#8B5CF6
    style D fill:#EFF6FF,stroke:#3B82F6
    style E fill:#ECFDF5,stroke:#10B981
```

**Luồng chi tiết:**

```mermaid
flowchart TD
    FAIL["❌ AI Generate fail"] --> REDIRECT["Redirect → Dashboard"]
    REDIRECT --> BANNER["⚠️ Banner: AI chưa hoàn tất"]
    
    BANNER --> USER{"User quyết định"}
    
    USER -->|"🔄 Retry AI<br/>(optional)"| RETRY["Quay lại /builder/new<br/>→ Thử lại với cùng thông tin"]
    USER -->|"📄 Chọn template"| TEMPLATE["Template Library CMS"]
    
    RETRY --> RETRY_CHECK{"Lần này thành công?"}
    RETRY_CHECK -->|"✅"| PREVIEW["Preview → Edit/Dashboard"]
    RETRY_CHECK -->|"❌"| REDIRECT
    
    TEMPLATE --> APPLY["Chọn template → Apply"]
    APPLY --> EDITOR["Editor: Chỉnh sửa nội dung"]
    EDITOR --> PUBLISH["🚀 Publish website"]
    
    PUBLISH --> DONE(["✅ Website hoàn thành<br/>Dù AI fail, user vẫn có website"])

    style FAIL fill:#FEE2E2,stroke:#EF4444
    style BANNER fill:#FEF3C7,stroke:#F59E0B
    style DONE fill:#ECFDF5,stroke:#10B981
    style TEMPLATE fill:#F5F3FF,stroke:#8B5CF6
```

---

## 6. Tổng hợp Dashboard States

| State | Điều kiện | UI hiển thị | CTA chính |
|-------|-----------|-------------|-----------|
| **A — Trống** | `totalSites = 0` | Empty state + CTA nổi bật | 🤖 Build with AI / 📄 Choose template |
| **B — AI incomplete** | Site có nhưng incomplete | ⚠️ Banner cảnh báo | 🔄 Retry AI / 📄 Chọn template CMS |
| **C — Draft** | Site draft hoàn chỉnh | Site card (draft badge) | ✏️ Edit / 🚀 Publish |
| **D — Published** | Site đã publish | Site card (published badge) + Analytics | 📊 View stats / ✏️ Edit |

> [!WARNING]
> **State B cần check thêm:** Hiện đang gom chung mọi lỗi AI về 1 case "AI không thành công → điều hướng chọn template". Cần xác nhận cụ thể case nào site đã tạo thành công trong DB nhưng lỗi ở phía client — để quyết định hiện draft hay hiện banner retry.

---

## 7. Mapping File → Flow Step

| Flow Step | Route | File chính |
|-----------|-------|-----------|
| Login + OTP | `/login`, `/verify-otp` | `(auth)/login/page.tsx`, `(auth)/verify-otp/page.tsx` |
| Auth Guard | — | `middleware.ts` |
| Welcome Screen | `/onboarding` | `(frontend)/onboarding/page.tsx` → `WelcomeScreenClient.tsx` |
| Builder Form | `/builder/new` | `AIBuilderPageClient.tsx` → BusinessInfoForm |
| Builder Generate | `/builder/new` | `AIBuilderPageClient.tsx` → GenerationView |
| Builder Preview | `/builder/new` | `AIBuilderPageClient.tsx` → CompletionView |
| API Generate | `/api/ai/generate-site` | `api/ai/generate-site/route.ts` |
| Dashboard | `/dashboard` | `(dashboard)/dashboard/page.tsx` → `DashboardOnboarding.tsx` |
| Template Library | `/templates` | (CMS template gallery) |
| Editor | `/editor/[siteId]` | `(editor)/editor/[siteId]/page.tsx` |

---

## 8. Open Items — Cần xác nhận

- [ ] **State B detect logic:** Cách phân biệt "site incomplete" vs "site draft hoàn chỉnh" — dùng field nào trong DB? (`status`, page count, hay thêm field mới?)
- [ ] **Banner UI:** Design cụ thể cho banner "Website tạo bằng AI chưa hoàn tất" — vị trí, màu sắc, wording
- [ ] **Retry AI behavior:** Retry sẽ UPDATE site cũ hay tạo site mới? (hiện tại API sẽ UPDATE nếu site đã tồn tại)
- [ ] **Template Library route:** Route `/templates` đã có sẵn chưa hay cần tạo mới?
- [ ] **Case "AI thành công nhưng lỗi client":** Xác nhận rõ các case cụ thể (network timeout, browser close, SSE stream ngắt...) để xử lý đúng
