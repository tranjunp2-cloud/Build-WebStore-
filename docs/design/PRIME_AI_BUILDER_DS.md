# 🎨 Prime AI Builder — Design System

**Optimized for AI-powered website builder interfaces and modern SaaS dashboards.**

> **Style Inspiration:** Vercel, Linear, Framer AI, Notion AI.
> **Visual Style:** Clean, minimal, modern, neutral UI with soft shadows and rounded corners.
> **Component Patterns:** shadcn/ui.

---

## 🎨 1. Color System

### Base Colors
- **Primary:** Indigo / Blue tone (e.g., `hsl(243, 75%, 59%)` — `#5E6AD2`)
- **Background (Builder Workspace):** Light gray (`hsl(210, 40%, 98%)` — `#FAFAFA`)
- **Card Background:** White (`hsl(0, 0%, 100%)` — `#FFFFFF`)
- **Foreground (Text):** Dark slate (`hsl(222, 47%, 11%)` — `#0F172A`)
- **Muted (Secondary Text/BG):** Nuetral gray (`hsl(210, 40%, 96.1%)` — `#F1F5F9`)

### Neutral (Borders & Backgrounds)
- **Border:** Light gray (`hsl(214.3, 31.8%, 91.4%)` — `#E2E8F0`)
- **Input:** Gray (`hsl(214.3, 31.8%, 91.4%)` — `#E2E8F0`)
- **Ring (Focus):** Primary Indigo (`hsl(243, 75%, 59%)`)

### Semantic Colors
- **Success:** Green (`hsl(142.1, 76.2%, 36.3%)` — `#16A34A`)
- **Error:** Red (`hsl(0, 84.2%, 60.2%)` — `#EF4444`)
- **Warning:** Amber (`hsl(38, 92%, 50%)` — `#F59E0B`)
- **Info:** Blue (`hsl(221.2, 83.2%, 53.3%)` — `#3B82F6`)

---

## 🔤 2. Typography

**Primary Font:** `Inter` (or `Plus Jakarta Sans` for marketing/headings)

| Scale | CSS Usage | Token | Focus |
|-------|-----------|-------|-------|
| **H1** | `text-3xl font-bold tracking-tight` | `30px / 700` | Page title / Hero |
| **H2** | `text-2xl font-semibold tracking-tight` | `24px / 600` | Section title |
| **Body** | `text-sm font-normal leading-relaxed` | `14px / 400` | Standard text / Chat |
| **Caption** | `text-xs font-normal text-muted` | `12px / 400` | Helper text / Logs |
| **Mono** | `font-mono text-sm` | `14px / Mono` | Code blocks / AI logs |

---

## 📐 3. Layout Tokens & Shadows

### Spacing Scale (Grid: 4px)
`4px` | `8px` | `12px` | `16px` | `24px` | `32px` | `48px` | `64px`

### Border Radius
- **sm:** `4px` (Tags, small inputs)
- **md:** `8px` (Buttons, inputs)
- **lg:** `12px` (Cards, panels)
- **xl:** `16px` (Modals, featured blocks)

### Shadow Styles (Soft & Clean)
- **Card Shadow:** `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` (Tailwind `shadow-sm`)
- **Panel Shadow:** `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` (Tailwind `shadow-md`)
- **Floating Toast/Popover Shadow:** `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` (Tailwind `shadow-xl`)

---

## 🧩 4. Component Library (Base)

*Consistent with shadcn/ui patterns.*

### Buttons
- **Primary:** Solid indigo background, white text. For main actions (e.g., "Generate").
- **Secondary:** Light gray background, dark text. For alternative actions.
- **Outline:** Transparent background, gray border. For secondary/cancel actions.
- **Ghost:** No background or border until hover. For subtle actions within lists/chat.
- **Icon Button:** Square bounds, used for Send, Edit, or Delete icons.

### Inputs
- **Text Input:** 40px height, rounded-md, visible focus ring.
- **Textarea:** Standard multiline input for descriptions.
- **Chat Input:** Specialized input with right-aligned floating Send button.
- **Disabled State:** Opacity 50%, unclickable, `cursor-not-allowed`.

### Cards
- **Standard Card:** Clean white background, 1px border, lg radius, soft shadow.
- **Builder Panel Card:** Slightly elevated, used for property editing or chat container.

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
