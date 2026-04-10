# Design System - PrimeWeb F05 (Standardized & Dev-Ready)

> [!IMPORTANT]
> This is the single source of truth for the F05 AI Editor project. All UI/UX implementations must align with these technical tokens and visual principles.

## 1. Typography
- **Primary Font Family:** `Inter`, sans-serif (Google Fonts)
- **Scale:**
  - `h1`: 32px / 2rem, Semi-bold
  - `h2`: 24px / 1.5rem, Semi-bold
  - `h3`: 18px / 1.125rem, Medium
  - `base`: 16px / 1rem, Regular
  - `small`: 14px / 0.875rem, Regular
  - `xs`: 12px / 0.75rem, Regular

## 2. Iconography
- **Library:** `Lucide Icons` (Standard for shadcn/ui)
- **Stroke Width:** 2px
- **Default Size:** 20px (base), 16px (small)

## 3. Theme & Colors (Dark Mode Default)
We use HSL color model for flexibility.

### Base Tokens (Dark Mode)
```css
:root {
  /* Default to Dark Mode */
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;

  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;

  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;

  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;

  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;

  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;

  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

## 4. Layout Mechanics
- **Z-Index Scale:**
  - `base`: 0
  - `dropdown`: 1000
  - `sticky`: 1020
  - `overlay`: 1030
  - `modal`: 1040
  - `popover`: 1050
  - `toast`: 1060 (Highest)

- **Animations:**
  - `transition-fast`: 150ms ease-in-out
  - `transition-normal`: 300ms ease-in-out

## 5. Component: F05 SettingsPanel
A critical component for the AI Editor.

| Property | Value | CSS Variable / Utility |
| :--- | :--- | :--- |
| **Background** | #020817 (Dark) | `var(--background)` |
| **Border Color** | #1e293b | `var(--border)` |
| **Padding** | 16px (4rem) | `p-4` |
| **Input Gap** | 12px | `gap-3` |
| **Corner Radius** | 8px | `rounded-lg` |

### Settings UI Elements
- **Color Swatch:** 24x24px circle with 2px white ring when active.
- **Alignment Toggle:** Segmented button group (Lucide icons: AlignLeft, AlignCenter, AlignRight).
- **Form Wrapper:** Vertical stack with label (xs, muted-foreground) and input field.
