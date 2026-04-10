# 🎨 Prime AI Builder — Design System

**Optimized for AI-powered website builder interfaces and modern SaaS dashboards.**

> **Style Inspiration:** Vercel, Linear, Framer AI, Notion AI.
> **Visual Style:** Clean, minimal, modern, neutral UI with soft shadows and rounded corners.
> **Component Patterns:** shadcn/ui.

---

## 🎨 1. Color System

### Global Themes
| Token | Dark Mode (Default) | Light Mode |
|-------|---------------------|------------|
| **Background** | `#0B1120` | `#F8FAFC` |
| **Surface** | `#161E2E` | `#FFFFFF` |
| **Primary Blue** | `#3B82F6` | `#2563EB` |
| **Primary Teal** | `#2DD4BF` | `#0D9488` |

### Neutral Scale
| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| **100** | `#FFFFFF` | `#0F172A` | Primary Foreground / Text |
| **400** | `#9CA3AF` | `#64748B` | Muted Text / Placeholder |
| **700** | `#374151` | `#CBD5E1` | Secondary Border |
| **800** | `#1F2937` | `#E2E8F0` | Base Border / Secondary BG |

### Semantic Status
| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| **Success** | `#10B981` | `#059669` |
| **Error** | `#EF4444` | `#DC2626` |
| **Warning** | `#F59E0B` | `#D97706` |
| **Info** | `#3B82F6` | `#2563EB` |

### Semantic Tokens (Components)
- **Button (Primary):**
  - **Background:** `linear-gradient(90deg, var(--primary-blue) 0%, var(--primary-teal) 100%)`
  - **Text:** `#FFFFFF` (Both modes)
  - **Radius:** `8px`
- **Button (Secondary):**
  - **Background:** Dark `#1F2937` / Light `#F1F5F9`
  - **Border:** Dark `#374151` / Light `#E2E8F0`
  - **Text:** Dark `#FFFFFF` / Light `#0F172A`
- **Input:**
  - **Background:** Dark `#161E2E` / Light `#FFFFFF`
  - **Border:** Dark `#1F2937` / Light `#E2E8F0`
  - **Text:** Dark `#FFFFFF` / Light `#0F172A`
  - **Placeholder:** Dark `#9CA3AF` / Light `#64748B`
- **Card:**
  - **Background:** Dark `#161E2E` / Light `#FFFFFF`
  - **Border:** Dark `#1F2937` / Light `#E2E8F0`
  - **Radius:** `12px`

---

## 🔤 2. Typography

**Primary Font:** `Inter, sans-serif`
**Font Weights:** Regular (`400`), Medium (`500`), Semibold (`600`), Bold (`700`)

### Heading Scale
| Token | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|-------------|
| **Heading 1** | `44px` | `54px` | `700` (bold) |
| **Heading 2** | `32px` | `40px` | `700` (bold) |
| **Heading 3** | `24px` | `32px` | `700` (bold) |
| **Heading 4** | `20px` | `26px` | `700` (bold) |
| **Heading 5** | `16px` | `24px` | `700` (bold) |

### Body & Subtitle Scale
| Token | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|-------------|
| **Subtitle 1** | `20px` | `24px` | `600` (semibold) |
| **Subtitle 2** | `14px` | `22px` | `600` (semibold) |
| **Body 1** | `16px` | `24px` | `400` (regular) |
| **Body 2** | `14px` | `22px` | `400` (regular) |

### Components & Extras
| Token | Font Size | Line Height | Font Weight |
|-------|-----------|-------------|-------------|
| **Button** | `14px` | `18px` | `700` (bold) |
| **Small 1** | `12px` | `16px` | `400` (regular) |
| **Small 2** | `12px` | `16px` | `600` (semibold) |

---

## 📐 3. Layout Tokens & Shadows

### Spacing Scale 
| Token | Value | Base |
|-------|-------|------|
| **0** | `0px` | 0 |
| **xs** | `4px` | 1 |
| **sm** | `8px` | 2 |
| **md** | `16px`| 4 |
| **lg** | `24px`| 6 |
| **xl** | `32px`| 8 |
| **2xl**| `48px`| 12 |
| **3xl**| `64px`| 16 |

### Sizing (Global Elements)
- **icon-sm:** `16px`
- **icon-md:** `24px`
- **sidebar-width:** `260px`
- **header-height:** `64px`
- **container-max:** `1440px`

### Semantic Layouts & Component Sizing
- **gap-cards:** `{spacing.lg}` (`24px`)
- **page-padding:** `{spacing.xl}` (`32px`)
- **card-padding:** `{spacing.md}` (`16px`)
- **section-margin:** `{spacing.2xl}` (`48px`)
- **input-height:** `40px`
- **button-height:** `40px`
- **avatar-md:** `32px`

### Border Radius
- **sm:** `4px` (Tags, small inputs)
- **md:** `8px` (Buttons, inputs)
- **lg:** `12px` (Cards, panels)
- **xl:** `16px` (Modals, featured blocks) *(Lưu ý: Bạn nhớ khai báo thêm xl vào hệ thống JSON ban đầu)*

### Shadow Styles (Soft & Clean)
*Lưu ý: Thay viền Drop Shadow thành Border hoặc nâng opacity 50-80% khi dùng ở Dark Mode để tạo độ nổi.*

- **Card Shadow:** 
  - **Light Mode:** `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` (Tailwind `shadow-sm`)
  - **Dark Mode:** `0 1px 3px 0 rgb(0 0 0 / 0.5)`
- **Panel Shadow:** 
  - **Light Mode:** `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` (Tailwind `shadow-md`)
  - **Dark Mode:** `0 4px 6px -1px rgb(0 0 0 / 0.6)`
- **Floating/Popover Shadow:** 
  - **Light Mode:** `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` (Tailwind `shadow-xl`)
  - **Dark Mode:** `0 20px 25px -5px rgb(0 0 0 / 0.8)`

---

## 🧩 4. Component Library (Base)

*Consistent with shadcn/ui patterns.*

### Buttons
- **Primary:** Dải màu Gradient (`linear-gradient` Blue sang Teal), chữ trắng. Dùng làm Action gọi sự chú ý lớn nhất.
- **Secondary:** Nền `#1F2937` (Dark) / `#F1F5F9` (Light), và chữ tương ứng. Dùng cho các alternative action.
- **Outline:** Không nền, viền xám mỏng. Dùng làm action phụ trợ/Cancel.
- **Ghost:** Không viền, không nền. Dùng cho các list tác vụ hay Chat action cần tiết chế không gian.
- **Icon Button:** Form vuông vức bo cong tiêu chuẩn, chứa icon Send, Edit, Delete...

### Inputs
- **Text Input:** Chiều cao 40px, góc bo `md` (`8px`), viền mỏng theo mode tông xám (`#E2E8F0` Light / `#1F2937` Dark). Focus chuyển vòng màu sang màu Primary (`#3B82F6`).
- **Textarea:** Form tự động đa dòng như text input cho khung nhập Description.
- **Chat Input:** Khung Input nâng cao chứa button Send bo góc nằm bên phải. Cực kì quan trọng cho Workflow AI.
- **Disabled State:** Giảm Opacity xuống 50%, tắt khả năng tương tác, hiện trỏ chuột `cursor-not-allowed`.

### Cards
- **Standard Card:** Background phân mảnh (`#161E2E` cho Dark và Trắng `#FFFFFF` cho Light), sử dụng border viền rất mỏng 1px với form bo góc `lg` (`12px`).
- **Builder Panel Card:** Elevated card nổi bậc hơn Standard card. Thường dùng trong Property Editing hoặc Container chứa Chat.

### Badges
- **Status Badge:** Filled or subtle background matching semantic colors.
- **Draft Badge:** Neutral gray or subtle yellow.
- **AI Badge:** Sparkle icon, gradient background or distinct primary color to denote AI action.

### Progress
- **Progress Bar:** Continuous smooth loading bar (Primary color).
- **Step Progress:** Discrete steps (e.g., 1. Analyzing -> 2. Building -> 3. Done).

### Skeleton (Loading States)
- **Text Skeleton:** Rounded-full, varying widths.
- **Block Skeleton:** Large rectangular blocks resembling layout structure.
- **Page Skeleton:** Full page layout skeleton without spinner.

### Toast Notifications
- Floating at bottom-right or top-center.
- **Success:** Green icon, success message.
- **Error:** Red icon, error message, Retry button.
- **Info:** Blue icon, informational message.

---

## 🤖 5. Builder-Specific Components

*Specialized components for the AI AI Builder Workflow.*

### 1. BuilderChatPanel
- **Layout:** Fixed width or flex container on left/bottom.
- **Features:** Scrollable message history, sticky chat input at bottom.

### 2. BuilderPreviewPanel
- **Layout:** Main right-side canvas. Light gray background.
- **Features:** Holds the live website preview (iframe or scaled container).

### 3. BuilderProgressSteps
- **Layout:** Vertical list of checklist items inside the chat or overlay.
- **States:** Pending (gray circle), Active (spinner/indigo circle), Done (green check).

### 4. AIMessageBubble / UserMessageBubble
- **User Bubble:** Right-aligned, primary muted background (or gray), standard text.
- **AI Bubble:** Left-aligned, white background with very soft shadow, contains rich text, blocks, or suggestions.

### 5. StreamingBlockPlaceholder
- **Usage:** While AI is generating a specific block (e.g., Hero).
- **UI:** A glowing or shimmering skeleton block integrated into the Preview Panel that transforms into the actual block when done.

### 6. DraftBadge
- **Usage:** Positioned top-right in the preview panel.
- **UI:** `Badge variant="secondary"` indicating the site is continuously auto-saved.
