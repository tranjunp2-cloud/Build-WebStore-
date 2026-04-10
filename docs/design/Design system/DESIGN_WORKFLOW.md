# AI-Editor Design Workflow & Specifications (F05)

## 1. Interaction Pipeline
The F05 AI Editor follows a "Chat-to-Action" workflow:
1. **User Input:** Natural language prompt via ChatPanel.
2. **AI Interpretation:** LLM identifies intent (Style change, Content update, Block insertion).
3. **Drafting:** AI proposes changes in a preview overlay.
4. **Finalization:** User confirms and AI updates the canvas.

## 2. Technical Hand-off Specs

### Canvas Architecture
- **Draft Layer:** Absolute overlay (z-index: 10).
- **Control Overlay:** Drawing handles and drag anchors (z-index: 1040).

### Color Token Implementation
Ensure all components use the following Dark Mode defaults:
- **Surface:** `#020817` (`var(--background)`)
- **Card/Panel:** `#020817` (`var(--card)`)
- **Primary Action:** `#ffffff` (`var(--primary)`)
- **Secondary Action:** `#1e293b` (`var(--secondary)`)

## 3. Typography & Icons
- Use **Inter** for all UI text.
- Use **Lucide React** for all iconography (standardized stroke and size as per `Design system.md`).

## 4. Animation Guidelines
- Hover state: `150ms ease-in-out`
- Panel slide: `300ms ease-in-out` (use `framer-motion` if possible).
