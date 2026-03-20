# User Stories: Help Center (F20)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F20 — Help Center
> **Wave:** 4 | **Priority:** P1 | **Ref PRD:** [F20-help-center.md](../prd/F20-help-center.md)

---

## US-F20-01: View 1-Page User Guideline

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```
As a   Store Owner or Staff
I want to view a 1-page user guideline summarizing all system features
So that I can quickly understand what the system offers and how to navigate it
```

### Acceptance Criteria

#### AC-1: Display 1-Page Guideline

```gherkin
GIVEN the user is logged into the CMS
WHEN  they navigate to the Help Center
THEN  they should see a 1-page user guideline
  AND the guideline should summarize all main features of the system
```

---

## US-F20-02: View Detailed Q&A

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```
As a   Store Owner or Staff
I want to view a detailed Q&A section
So that I can find answers to common questions and troubleshoot issues independently
```

### Acceptance Criteria

#### AC-1: Display Q&A Section

```gherkin
GIVEN the user is in the Help Center
WHEN  they view the Q&A section or search for a question
THEN  they should see a list of detailed, categorized questions and answers
  AND they can expand/collapse answers (accordion style)
```

---

## US-F20-03: View Module-Specific Instructions with Screenshots

**Wave 4** | **P1** | **L** | **Status:** Ready

### Story

```
As a   Store Owner or Staff
I want to view step-by-step instructions for each module, complete with screenshots
So that I can learn exactly how to use specific functionalities without guessing
```

### Acceptance Criteria

#### AC-1: Display Module Instructions

```gherkin
GIVEN the user is in the Help Center
WHEN  they select a specific module (e.g., Products, Orders, AI Editor)
THEN  they should see step-by-step text instructions
  AND each major step should be accompanied by clear screenshots
```

#### AC-2: Expand Screenshots

```gherkin
GIVEN the user is viewing module instructions
WHEN  they click on a screenshot
THEN  the screenshot should expand in a lightbox/modal for better visibility
  AND they can close it to return to the text
```

### Additional Criteria

- [ ] Hình ảnh screenshot phải được optimize dung lượng định dạng WebP để trang load nhanh.
- [ ] Giao diện Help Center phải hiển thị tốt trên thiết bị di động (Mobile Responsive).

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Tất cả guideline và Q&A đã được PO/Business review.

---

## US-F20-04: Mobile Web UX — Pinch-to-Zoom Lightbox

**Wave 4** | **P2** | **S** | **Status:** Ready

### Story

```
As a   Store Owner or Staff
I want the instruction screenshots to be fully readable on a small mobile screen
So that I can actually see the UI details when reading guides on my phone
```

### Acceptance Criteria

#### AC-1: Pinch-to-Zoom Support

```gherkin
GIVEN the user opens a screenshot in the Lightbox on a mobile device
WHEN  they use the pinch gesture (two fingers spreading) or double-tap
THEN  the image zooms in smoothly without exiting the lightbox
```

#### AC-2: Mobile-Friendly Navigation

```gherkin
GIVEN the user is reading a module guide on mobile
WHEN  they view the page
THEN  the left Sidebar navigation shifts to a sticky top dropdown or horizontal scrollable tab-bar to preserve vertical reading space
```

### Definition of Done
- [ ] 9-Point Checklist pass for mobile mode.

